import struct, os

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"
backup_dir = r"C:\Users\corin\Desktop\CD JSON Mod Manager\backups"

# Check what we have
meta = os.path.join(game_dir, "meta")
current = open(os.path.join(meta, "0.papgt"), "rb").read()
bak = open(os.path.join(meta, "0.papgt.bak"), "rb").read()

print(f"Current: {len(current)} bytes, has 0036: {b'0036' in current}")
print(f".bak:    {len(bak)} bytes, has 0036: {b'0036' in bak}")

# Check mod manager's original backup
orig_path = os.path.join(backup_dir, "0.papgt.original")
if os.path.exists(orig_path):
    orig = open(orig_path, "rb").read()
    print(f"0.papgt.original: {len(orig)} bytes, has 0036: {b'0036' in orig}")
    print(f"  Header: {orig[:12].hex()}")

# The game's .bak is the WORKING papgt without 0036 (577 bytes)
# Our current is 594 bytes with 0036 but broken header hash

# Let me look at the hex dump from earlier in the conversation
# The WORKING modded PAPGT had these characteristics:
# - 594 bytes
# - Header hash: 0xc4d14040 at offset 4
# - 0036 at the START of the folder names
# The clean PAPGT (577 bytes) has:
# - Header hash: 0x1aabb7c9 at offset 4

print(f"\nCurrent header: {current[:16].hex()}")
print(f"Clean header:   {bak[:16].hex()}")

# From the hex dump at the very start of this conversation, the MODDED papgt was:
# 6004 0000 c4d1 4040 2202 0000 00ff 3f00
# offset 0: 0x00000460 (1120)
# offset 4: 0x4040d1c4 (hash)
# offset 8: 0x00000222 (546)
#
# The CLEAN papgt was:
# 6004 0000 1aab b7c9 2102 0000 00ff 3f00
# offset 0: 0x00000460 (1120)
# offset 4: 0xc9b7ab1a (hash)
# offset 8: 0x00000221 (545)
#
# So the modded version had:
# - Same offset 0 value (0x460 = 1120)
# - Different hash at offset 4
# - offset 8 went from 0x221 (545) to 0x222 (546) - entry count +1!

# Our version changed offset 0 (adding 17), which is WRONG
# offset 0 should stay the SAME
# offset 8 should increment by 1 (one more entry)
# offset 4 needs proper hash recalculation (or we just set it)

# Let me fix our PAPGT
print("\n--- Fixing PAPGT ---")

# Start from the clean bak and properly add 0036
clean = bytearray(bak)

# Parse clean header
hdr_val0 = struct.unpack_from("<I", clean, 0)[0]  # 0x460
hdr_hash = struct.unpack_from("<I", clean, 4)[0]   # hash
hdr_val2 = struct.unpack_from("<I", clean, 8)[0]   # 0x221 = 545 (entry count or size indicator)

print(f"Clean: val0=0x{hdr_val0:x}, hash=0x{hdr_hash:x}, val2=0x{hdr_val2:x}")

# Find names block
names_start = clean.find(b"0000\x00")
names_block_start = names_start - 4
entry_count = (names_block_start - 12) // 12

print(f"Entry count: {entry_count}")
print(f"Names start: {names_start}")

# Build new PAPGT properly
new = bytearray()

# Header - keep val0 the SAME, hash will be wrong but let's try, increment val2 by 1
new.extend(struct.pack("<I", hdr_val0))  # offset 0: SAME
new.extend(struct.pack("<I", hdr_hash))  # offset 4: same hash (may need recalc)
new.extend(struct.pack("<I", hdr_val2 + 1))  # offset 8: +1 for new entry

# Add 0036 entry at the START
# Use the hash from the original modded PAPGT: 0x12f7b25e
new.extend(struct.pack("<III", 0x003FFF00, 0, 0x12f7b25e))

# Copy existing entries with shifted name offsets
for i in range(entry_count):
    off = 12 + i * 12
    flags, name_off, ehash = struct.unpack_from("<III", clean, off)
    new.extend(struct.pack("<III", flags, name_off + 5, ehash))

# Names block length + names
existing_names = clean[names_start:]
new_names = b"0036\x00" + bytes(existing_names)
new.extend(struct.pack("<I", len(new_names)))
new.extend(new_names)

print(f"New PAPGT: {len(new)} bytes")
print(f"New header: {new[:12].hex()}")

# Write
open(os.path.join(meta, "0.papgt"), "wb").write(new)
print("Written!")

# Verify
test = open(os.path.join(meta, "0.papgt"), "rb").read()
print(f"Has 0036: {b'0036' in test}")
