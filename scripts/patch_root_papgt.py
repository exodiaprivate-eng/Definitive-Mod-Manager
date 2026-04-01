import struct, os, shutil

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

# The ROOT 0.papgt is the one the original mod manager modified!
# Header 0x460 matches what we captured in the hex dumps earlier
root_papgt = os.path.join(game_dir, "0.papgt")
papgt = bytearray(open(root_papgt, "rb").read())

print(f"Root 0.papgt: {len(papgt)} bytes")
val0 = struct.unpack_from("<I", papgt, 0)[0]
hash_val = struct.unpack_from("<I", papgt, 4)[0]
val2 = struct.unpack_from("<I", papgt, 8)[0]
print(f"  val0=0x{val0:08x}, hash=0x{hash_val:08x}, val2=0x{val2:08x}")
print(f"  Has 0036: {b'0036' in papgt}")

if b"0036" in papgt:
    print("Already has 0036, nothing to do")
    exit(0)

# Backup
backup = root_papgt + ".clean"
if not os.path.exists(backup):
    shutil.copy2(root_papgt, backup)
    print(f"Backed up to {backup}")

# Find names block
names_start = papgt.find(b"0000\x00")
names_block_start = names_start - 4
entry_count = (names_block_start - 12) // 12
print(f"Entries: {entry_count}, names at: {names_start}")

# Parse names
pos = names_start
names = []
while pos < len(papgt):
    end = papgt.find(b"\x00", pos)
    if end < 0:
        break
    name = papgt[pos:end].decode("ascii", errors="ignore")
    if name:
        names.append(name)
    pos = end + 1
print(f"Folders: {names[:5]}...{names[-3:]}")

# Build new PAPGT
new = bytearray()

# Keep val0 and hash EXACTLY the same, only increment val2
new.extend(papgt[:4])   # val0
new.extend(papgt[4:8])  # hash - DON'T TOUCH
new.extend(struct.pack("<I", val2 + 1))  # val2 + 1

# Add 0036 entry
new.extend(struct.pack("<III", 0x003FFF00, 0, 0x12f7b25e))

# Existing entries with shifted name offsets
for i in range(entry_count):
    off = 12 + i * 12
    flags, noff, ehash = struct.unpack_from("<III", papgt, off)
    new.extend(struct.pack("<III", flags, noff + 5, ehash))

# Names
existing_names = papgt[names_start:]
new_names = b"0036\x00" + bytes(existing_names)
new.extend(struct.pack("<I", len(new_names)))
new.extend(new_names)

print(f"\nNew: {len(new)} bytes, header: {new[:12].hex()}")

open(root_papgt, "wb").write(new)
print("Written ROOT 0.papgt with 0036!")
print(f"Has 0036: {b'0036' in new}")
