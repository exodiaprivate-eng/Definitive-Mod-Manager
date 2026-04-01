import struct, sys, os

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"
papgt_path = os.path.join(game_dir, "meta", "0.papgt")

papgt = bytearray(open(papgt_path, "rb").read())
print(f"Current PAPGT: {len(papgt)} bytes")

if b"0036" in papgt:
    print("0036 already in PAPGT, nothing to do")
    sys.exit(0)

# Find names block - look for '0000\x00' pattern
names_start = papgt.find(b"0000\x00")
print(f"Names start at: {names_start}")

# Names block length is 4 bytes before names
names_block_start = names_start - 4
names_block_len = struct.unpack_from("<I", papgt, names_block_start)[0]
print(f"Names block length: {names_block_len}")

# Entry count: (names_block_start - 12) / 12
entry_count = (names_block_start - 12) // 12
print(f"Entry count: {entry_count}")

# Parse existing entries
entries = []
for i in range(entry_count):
    off = 12 + i * 12
    flags, name_off, folder_hash = struct.unpack_from("<III", papgt, off)
    entries.append((flags, name_off, folder_hash))

# Parse existing names
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

print(f"Current folders: {names}")

# Build new PAPGT with 0036 prepended
# New entry for 0036 overlay
# Hash from the original modded PAPGT analysis
new_hash = 0x12f7b25e

# Header (12 bytes) - copy as-is
new_papgt = bytearray(papgt[:12])

# Add 0036 entry first
new_papgt.extend(struct.pack("<III", 0x003FFF00, 0, new_hash))

# Shift all existing name offsets by 5 ('0036\0' = 5 bytes)
for flags, name_off, folder_hash in entries:
    new_papgt.extend(struct.pack("<III", flags, name_off + 5, folder_hash))

# Names block: '0036\0' + existing names
new_names = b"0036\x00"
for name in names:
    new_names += name.encode("ascii") + b"\x00"

# Names block length
new_papgt.extend(struct.pack("<I", len(new_names)))

# Names data
new_papgt.extend(new_names)

# Update header field 0 (may need updating for new count)
# Original field at offset 0 might encode the total size or entry count
# Let's update it: original value + 12 (one new entry) + 5 (new name)
old_val = struct.unpack_from("<I", papgt, 0)[0]
new_val = old_val + 17  # 12 bytes entry + 5 bytes name
struct.pack_into("<I", new_papgt, 0, new_val)

print(f"\nNew PAPGT: {len(new_papgt)} bytes")
print(f"New entry count: {entry_count + 1}")

# Save backup first
backup = papgt_path + ".bak2"
if not os.path.exists(backup):
    open(backup, "wb").write(papgt)
    print(f"Backed up to {backup}")

# Write new PAPGT
open(papgt_path, "wb").write(new_papgt)
print("Written new PAPGT with 0036!")

# Verify
test = open(papgt_path, "rb").read()
print(f"Has 0036: {b'0036' in test}")
print(f"New size: {len(test)} bytes")
