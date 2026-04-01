"""Mount multiple mods by building correct overlay PAZ/PAMT/PAPGT."""
import sys, os, struct, json, lz4.block
from pathlib import Path

sys.path.insert(0, str(Path(r"C:\Users\corin\Desktop\CD JSON Mod Manager\CrimsonDesert-UltimateModsManager-1.6.2\src")))
from cdumm.archive.paz_parse import parse_pamt
from cdumm.archive.hashlittle import hashlittle, INTEGRITY_SEED

game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert")
backup_dir = Path(r"C:\Users\corin\Desktop\CD JSON Mod Manager\backups")
mods_dir = Path(r"C:\Users\corin\Desktop\CD JSON Mod Manager\mods")

# The REFERENCE overlay PAMT DirBlock is ALWAYS these 48 bytes
# for gamedata/binary__/client/bin
# Hardcode it — it never changes for pabgb files
REF_DIR_BLOCK = bytes.fromhex(
    "ffffffff" "08" "67616d6564617461"     # FFFFFFFF + len=8 + "gamedata"
    "00000000" "09" "2f62696e6172795f5f"   # parent=0 + len=9 + "/binary__"
    "0d000000" "07" "2f636c69656e74"       # parent=13 + len=7 + "/client"
    "1b000000" "04" "2f62696e"             # parent=27 + len=4 + "/bin"
)
# The /bin directory is at offset 0x14 (20) in the DirBlock
BIN_DIR_OFFSET = 0x14  # offset of "/bin" entry = 27 decimal... wait

# Actually let me recalculate:
# gamedata: starts at 0, takes 4+1+8 = 13 bytes
# /binary__: starts at 13, takes 4+1+9 = 14 bytes -> ends at 27
# /client: starts at 27, takes 4+1+7 = 12 bytes -> ends at 39
# /bin: starts at 39 (0x27), takes 4+1+4 = 9 bytes -> ends at 48
# So the LAST dir entry (/bin) is at offset 39 in the DirBlock

# From the reference: HashEntry nameOffset = 0x27 = 39 (offset of /bin in DirBlock)
BIN_DIR_OFFSET = 39  # NOT 0x14

# Verify
assert len(REF_DIR_BLOCK) == 48

# --- Extract files ---
group_dir = game_dir / "0008"
entries = parse_pamt(str(group_dir / "0.pamt"), paz_dir=str(group_dir))

# Load storeinfo clean
storeinfo = bytearray(open(backup_dir / "storeinfo_clean.bin", "rb").read())
print(f"Clean storeinfo: {len(storeinfo)} bytes")

# Extract inventory
inv_entry = next((e for e in entries if "inventory.pabgb" in e.path), None)
with open(inv_entry.paz_file, "rb") as f:
    f.seek(inv_entry.offset)
    raw = f.read(inv_entry.comp_size)
inv_data = lz4.block.decompress(raw, uncompressed_size=inv_entry.orig_size)
print(f"Extracted inventory: {len(inv_data)} bytes")

# --- Apply patches ---
for mf in ["999BackpackinShop.json", "ALL Craft Material Ventor Shop.json"]:
    mod = json.load(open(mods_dir / mf))
    for patch in mod["patches"]:
        for change in patch["changes"]:
            off = change["offset"]
            patched = bytes.fromhex(change["patched"])
            storeinfo[off:off+len(patched)] = patched

inv_mod = bytearray(inv_data)
mod = json.load(open(mods_dir / "CDInventoryExpander.json"))
for patch in mod["patches"]:
    for change in patch["changes"]:
        off = change["offset"]
        patched = bytes.fromhex(change["patched"])
        inv_mod[off:off+len(patched)] = patched

# --- Compress ---
store_comp = lz4.block.compress(bytes(storeinfo), store_size=False)
inv_comp = lz4.block.compress(bytes(inv_mod), store_size=False)

inv_padded = (len(inv_comp) + 15) & ~15
store_padded = (len(store_comp) + 15) & ~15

# --- Build PAZ ---
# Files sorted alphabetically: inventory first, then storeinfo
paz = bytearray()
paz.extend(inv_comp + b"\x00" * (inv_padded - len(inv_comp)))
paz.extend(store_comp + b"\x00" * (store_padded - len(store_comp)))
print(f"\nPAZ: inv={len(inv_comp)}(pad {inv_padded}), store={len(store_comp)}(pad {store_padded}), total={len(paz)}")

# --- Build PAMT matching EXACT reference format ---
# Reference overlay format (verified working for single file):
# [HeaderCrc:4][PazCount:4][Magic:4]
# [PazInfo: idx:4, crc:4, size:4]
# [DirBlockSize:4][DirBlock:48]
# [FnBlockSize:4][FnBlock:var]  <-- NO sentinel between dir and fn!
# [HashCount:4][HashEntries:16*N]
# [FileRecordCount:4][FileRecords:20*N]

# Wait - looking at the reference hex dump more carefully:
# After DirBlock (48 bytes at offset 28), the next bytes are:
# 0050: ff ff ff ff 0f 73 74 6f 72 65 69 6e 66 6f 2e 70
# That's: FFFFFFFF (parent offset for filename) + 0F (len=15) + "storeinfo.pabg"
# There's NO FnBlockSize field! The filename entries follow DIRECTLY.
#
# And before the filename section, there's no sentinel or size field.
# The DirBlock size (48 = 0x30) at offset 24 tells you where DirBlock ends.
# Then filenames start immediately.
#
# But WAIT - the reference also has:
# 0060: 61 62 67 62 01 00 00 00 58 8b 75 ce 27 00 00 00
# After "storeinfo.pabgb" (15 bytes + FFFFFFFF parent + 01 len byte = 20 bytes)
# Then: 01 00 00 00 = hash_count = 1
# Then: 58 8b 75 ce = folder_hash
# Then: 27 00 00 00 = nameOffset (39 = /bin dir offset)
# Then: 00 00 00 00 01 00 00 00 = fileStart=0, fileCount=1
# Then: 01 00 00 00 = fileRecordCount = 1 ... wait that's wrong
#
# Actually: 00 00 00 00 = padding? No...
# Let me re-examine byte by byte from offset 0x50:

# Ref bytes from DirBlock end (offset 76 = 0x4C):
# 14 00 00 00 = this is the LAST 4 bytes of DirBlock (/bin parent = 0x1B... no wait)
#
# DirBlock starts at offset 28 (0x1C), size = 48 (0x30)
# So DirBlock ends at 28+48 = 76 (0x4C)
# At 0x4C: ff ff ff ff = start of filename section (parent offset = root)
#
# OK so there's NO separate size field for filenames - they follow DirBlock directly
# The game parser probably reads until it hits the hash table

# Let me check CDUMM's parse_pamt code again - it reads:
# 1. folder_size = folder section (includes all dir entries)
# 2. node_size = node section (path tree)
# 3. folder_count + hash entries
# 4. file records
#
# For OVERLAY PAMTs, the "folder section" has DirBlock,
# and the "node section" has filenames
# Both are prefixed with their size

# So the format IS: [DirBlockSize:4][DirBlock][FnBlockSize:4][FnBlock]
# But CDUMM's parser calls them "folder section" and "node section"

# Let me re-examine: the reference at offset 24 = 0x30 = 48 (DirBlock size)
# DirBlock = 48 bytes (offsets 28-75)
# At offset 76 (0x4C): this should be FnBlockSize
# But hex shows: 14 00 00 00 = 20
# Is FnBlockSize = 20? That would mean FnBlock = 20 bytes
# 0x50-0x63 = 20 bytes = FFFFFFFF + 0F + "storeinfo.pabgb" = 4+1+15 = 20 YES!

# So reference single-file PAMT:
# [0x00] HeaderCrc = 4
# [0x04] PazCount = 4 (value: 1)
# [0x08] Magic = 4 (value: 0x610E0232)
# [0x0C] Zero = 4
# [0x10] PazCrc = 4
# [0x14] PazFileSize = 4
# [0x18] DirBlockSize = 4 (value: 48)
# [0x1C] DirBlock = 48
# [0x4C] FnBlockSize = 4 (value: 20)
# [0x50] FnBlock = 20
# [0x64] HashCount = 4 (value: 1)
# [0x68] HashEntry = 16 (hash, nameOff, fileStart, fileCount)
# [0x78] FileRecordCount = 4 (value: 1)
# [0x7C] FileRecord = 20
# Total: 4+4+4+4+4+4+4+48+4+20+4+16+4+20 = 144 ✓

# Wait... offset 0x0C should be the start of PazInfo
# The header is: [HeaderCrc:4][PazCount:4][Magic:4] = 12 bytes at 0x00-0x0B
# Then PazInfo starts at 0x0C
# Reference at 0x0C: 00 00 00 00 = PazInfo.Index = 0
# But CDUMM parser skips: off += 4 (hash) + off += 4 (size) for each paz
# For 1 paz: hash at 0x0C... no that doesn't match

# Let me just look at raw bytes:
# 0x00: 79 0e f2 ba = HeaderCrc
# 0x04: 01 00 00 00 = PazCount (1)
# 0x08: 32 02 0e 61 = Magic
# 0x0C: 00 00 00 00 = zero
# 0x10: 6e d3 f0 73 = PazCrc
# 0x14: 80 7a 01 00 = PazFileSize (96896)
# 0x18: 30 00 00 00 = DirBlockSize (48)

# CDUMM parser does:
# off = 4 (skip magic=HeaderCrc)
# paz_count = data[4:8] = 1; off = 8
# off += 8 (skip hash+zero) -> off = 16
# PAZ table: for i in range(1): off += 4(hash) + 4(size) = off = 24
# folder_size = data[24:28]; off = 28
#
# So CDUMM reads: [4:8]=PazCount, skips [8:16], PAZ table at [16:24]
# PAZ table entry = [hash:4][size:4] = PazCrc + PazFileSize
# Then DirBlockSize at [24:28]
#
# This means the overlay format from CDUMM's perspective:
# [0x00] HeaderCrc
# [0x04] PazCount
# [0x08] Hash (part of "hash+zero" skip = Magic)
# [0x0C] Zero
# [0x10] PAZ table entry 0: hash(=PazCrc) + size(=PazFileSize)
# [0x18] DirBlockSize
# ...

# Great, this matches! Now build for 2 files:

pamt = bytearray()

# [0] HeaderCrc placeholder
pamt.extend(b"\x00\x00\x00\x00")
# [4] PazCount = 1
pamt.extend(struct.pack("<I", 1))
# [8] Magic
pamt.extend(struct.pack("<I", 0x610E0232))
# [12] Zero
pamt.extend(struct.pack("<I", 0))
# [16] PazCrc placeholder
pamt.extend(struct.pack("<I", 0))
# [20] PazFileSize
pamt.extend(struct.pack("<I", len(paz)))
# [24] DirBlockSize = 48
pamt.extend(struct.pack("<I", 48))
# [28] DirBlock (hardcoded 48 bytes)
pamt.extend(REF_DIR_BLOCK)
# [76] FnBlockSize
fn_names = [b"inventory.pabgb", b"storeinfo.pabgb"]
fn_block = bytearray()
fn_name_offsets = []
for name in fn_names:
    fn_name_offsets.append(len(fn_block))
    fn_block.extend(struct.pack("<I", 0xFFFFFFFF))  # parent = root
    fn_block.append(len(name))
    fn_block.extend(name)
pamt.extend(struct.pack("<I", len(fn_block)))
pamt.extend(fn_block)

# Hash entry: 1 folder (gamedata/binary__/client/bin)
folder_hash = hashlittle(b"gamedata/binary__/client/bin", INTEGRITY_SEED)
pamt.extend(struct.pack("<I", 1))  # hash count
pamt.extend(struct.pack("<IIII", folder_hash, BIN_DIR_OFFSET, 0, len(fn_names)))

# File records
pamt.extend(struct.pack("<I", len(fn_names)))  # file count
# inventory (index 0)
pamt.extend(struct.pack("<IIIIhH", fn_name_offsets[0], 0, len(inv_comp), len(inv_mod), 0, 0x0002))
# storeinfo (index 1)
pamt.extend(struct.pack("<IIIIhH", fn_name_offsets[1], inv_padded, len(store_comp), len(storeinfo), 0, 0x0002))

# Set PazCrc
paz_crc = hashlittle(bytes(paz), INTEGRITY_SEED)
struct.pack_into("<I", pamt, 16, paz_crc)

# Set HeaderCrc = hashlittle(pamt[12:], INTEGRITY_SEED)
header_crc = hashlittle(bytes(pamt[12:]), INTEGRITY_SEED)
struct.pack_into("<I", pamt, 0, header_crc)

print(f"PAMT: {len(pamt)} bytes, HeaderCrc=0x{header_crc:08x}, PazCrc=0x{paz_crc:08x}")

# Verify PAMT structure
comp0 = struct.unpack_from("<I", pamt, len(pamt)-20*2-4+4+4)[0]
print(f"Verify: file record 0 pazOff={struct.unpack_from('<I', pamt, len(pamt)-40+4)[0]}")

# --- Write overlay ---
(game_dir / "0036").mkdir(exist_ok=True)
open(game_dir / "0036" / "0.paz", "wb").write(paz)
open(game_dir / "0036" / "0.pamt", "wb").write(pamt)

# --- Build PAPGT ---
papgt_clean = open(backup_dir / "papgt_clean.bin", "rb").read()
entry_count = papgt_clean[8]
names_start = papgt_clean.find(b"0000\x00")

new_papgt = bytearray()
new_papgt.extend(papgt_clean[:4])       # PlatformMagic
new_papgt.extend(b"\x00\x00\x00\x00")  # Hash placeholder
new_papgt.append(entry_count + 1)
new_papgt.extend(papgt_clean[9:12])

# 0036 entry
new_papgt.append(0)
new_papgt.extend(struct.pack("<H", 0x3FFF))
new_papgt.append(0)
new_papgt.extend(struct.pack("<I", 0))
new_papgt.extend(struct.pack("<I", header_crc))  # PamtCrc = PAMT HeaderCrc

for i in range(entry_count):
    off = 12 + i * 12
    new_papgt.extend(papgt_clean[off:off+4])
    name_off = struct.unpack_from("<I", papgt_clean, off + 4)[0]
    new_papgt.extend(struct.pack("<I", name_off + 5))
    new_papgt.extend(papgt_clean[off+8:off+12])

new_names = b"0036\x00" + papgt_clean[names_start:]
new_papgt.extend(struct.pack("<I", len(new_names)))
new_papgt.extend(new_names)

papgt_hash = hashlittle(bytes(new_papgt[12:]), INTEGRITY_SEED)
struct.pack_into("<I", new_papgt, 4, papgt_hash)

open(game_dir / "meta" / "0.papgt", "wb").write(new_papgt)
print(f"PAPGT: {len(new_papgt)} bytes, hash=0x{papgt_hash:08x}")

# --- Verify ---
print(f"\nVerification:")
test_pamt = open(game_dir / "0036" / "0.pamt", "rb").read()
test_crc = hashlittle(test_pamt[12:], INTEGRITY_SEED)
print(f"  PAMT HeaderCrc match: {struct.unpack_from('<I', test_pamt, 0)[0] == test_crc}")

test_papgt = open(game_dir / "meta" / "0.papgt", "rb").read()
test_pcrc = hashlittle(test_papgt[12:], INTEGRITY_SEED)
print(f"  PAPGT hash match: {struct.unpack_from('<I', test_papgt, 4)[0] == test_pcrc}")

# Try decompressing both files from the PAZ
test_paz = open(game_dir / "0036" / "0.paz", "rb").read()
try:
    d1 = lz4.block.decompress(test_paz[0:len(inv_comp)], uncompressed_size=len(inv_mod))
    print(f"  inventory decompressed: {len(d1)} bytes OK")
except Exception as e:
    print(f"  inventory FAILED: {e}")
try:
    d2 = lz4.block.decompress(test_paz[inv_padded:inv_padded+len(store_comp)], uncompressed_size=len(storeinfo))
    print(f"  storeinfo decompressed: {len(d2)} bytes OK")
except Exception as e:
    print(f"  storeinfo FAILED: {e}")

print("\nDone! Launch the game to test all 3 mods.")
