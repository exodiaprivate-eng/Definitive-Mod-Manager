import struct, zlib, hashlib

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

# The working PAPGT (bak2) - 0x468 header, hash 0x3dba5786
papgt = open(f"{game_dir}\\meta\\0.papgt", "rb").read()

# From the VERY FIRST hex dump in the conversation, we captured TWO versions:
#
# MODDED (with 0036, 594 bytes) - this was WORKING in-game:
#   0x00: 6004 0000 c4d1 4040 2202 0000
#   val0=0x00000460, hash=0x4040d1c4, val2=0x00000222
#   Names: 0036, 0000, 0001, ...0032, 0035
#
# CLEAN (without 0036, 577 bytes) - also working:
#   0x00: 6004 0000 1aab b7c9 2102 0000
#   val0=0x00000460, hash=0xc9b7ab1a, val2=0x00000221
#   Names: 0000, 0001, ...0032, 0035
#
# BUT the current working PAPGT (bak2) has DIFFERENT values:
#   val0=0x00000468, hash=0x3dba5786, val2=0x00000221

print(f"Current working PAPGT: {len(papgt)} bytes")
val0 = struct.unpack_from("<I", papgt, 0)[0]
hash_val = struct.unpack_from("<I", papgt, 4)[0]
val2 = struct.unpack_from("<I", papgt, 8)[0]
print(f"  val0=0x{val0:08x} ({val0})")
print(f"  hash=0x{hash_val:08x}")
print(f"  val2=0x{val2:08x} ({val2})")
print(f"  has 0036: {b'0036' in papgt}")

# val0 changed from 0x460 to 0x468 between game versions
# This is likely the TOTAL SIZE of the PAPGT data (excluding something)
# 0x468 = 1128, 0x460 = 1120
# Current file is 577 bytes... doesn't match directly
# But 577 + some_header = ?

# Actually, val0 might be total size of entry_table + names_block
# 12 + 33*12 + 4 + 165 = 12 + 396 + 4 + 165 = 577 - yep that's the whole file
# But 577 != 0x468 (1128)
# Maybe val0 includes the PAMT/PAZ data sizes?

# Let me check: val2 = 0x221 = 545
# With 33 entries: (val2 - some_base) = entry count?
# 545 - 33 = 512? No clear pattern

# The hash might actually be computed from the GAME DATA, not just the PAPGT
# Or it could be a version identifier that needs to match the game version

# Let me check: 0.paver has the game version
paver = open(f"{game_dir}\\meta\\0.paver", "rb").read()
print(f"\n0.paver: {paver.hex()} ({len(paver)} bytes)")
paver_vals = struct.unpack("<HHI", paver[:8])
print(f"  vals: {paver_vals}")

# Maybe the hash is derived from the paver version?
# paver: 01000100030082ae1c37
# That's: 0x0001, 0x0001, 0x03, 0xae820000, 0x371c

# Different approach: maybe the game doesn't actually CHECK the hash
# and the error was from something else. Let me try:
# 1. Take the working PAPGT
# 2. Add 0036 entry
# 3. Keep val0 the SAME
# 4. Just increment val2 by 1
# 5. DON'T touch the hash at all

print("\n--- Building modded PAPGT (keeping original hash) ---")

names_start = papgt.find(b"0000\x00")
names_block_start = names_start - 4
entry_count = (names_block_start - 12) // 12
print(f"Entries: {entry_count}, names at: {names_start}")

new = bytearray()

# Header: keep val0 same, keep hash SAME, increment val2 by 1
new.extend(papgt[:4])  # val0 - same
new.extend(papgt[4:8])  # hash - SAME (don't touch!)
new.extend(struct.pack("<I", val2 + 1))  # val2 + 1

# 0036 entry first
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

print(f"New PAPGT: {len(new)} bytes")
print(f"Header: {new[:12].hex()}")

# Save as a test file first (don't overwrite the working one yet)
test_path = f"{game_dir}\\meta\\0.papgt.test"
open(test_path, "wb").write(new)
print(f"Saved test version to {test_path}")
print(f"To test: copy 0.papgt.test -> 0.papgt and launch game")
