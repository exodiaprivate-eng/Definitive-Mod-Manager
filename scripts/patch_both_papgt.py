import struct, zlib, os, shutil

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

def add_0036_to_papgt(papgt_path, backup_suffix):
    papgt = bytearray(open(papgt_path, "rb").read())

    if b"0036" in papgt:
        print(f"  Already has 0036")
        return

    # Backup
    backup = papgt_path + backup_suffix
    if not os.path.exists(backup):
        shutil.copy2(papgt_path, backup)

    val0 = struct.unpack_from("<I", papgt, 0)[0]
    val2 = struct.unpack_from("<I", papgt, 8)[0]

    names_start = papgt.find(b"0000\x00")
    names_block_start = names_start - 4
    entry_count = (names_block_start - 12) // 12

    print(f"  val0=0x{val0:x}, val2=0x{val2:x}, entries={entry_count}")

    new = bytearray()

    # Header: keep val0, skip hash (will recalculate), increment val2
    new.extend(struct.pack("<I", val0))
    new.extend(b"\x00\x00\x00\x00")  # placeholder for hash
    new.extend(struct.pack("<I", val2 + 1))

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

    # Calculate header hash (CRC32 of bytes 4+)
    header_crc = zlib.crc32(bytes(new[4:])) & 0xFFFFFFFF
    new[4:8] = struct.pack("<I", header_crc)

    print(f"  New: {len(new)} bytes, hash=0x{header_crc:08x}")

    open(papgt_path, "wb").write(new)
    print(f"  Written!")

# Patch ROOT 0.papgt
print("Root 0.papgt:")
root_path = os.path.join(game_dir, "0.papgt")
add_0036_to_papgt(root_path, ".clean2")

# Patch META 0.papgt
print("\nMeta 0.papgt:")
meta_path = os.path.join(game_dir, "meta", "0.papgt")
add_0036_to_papgt(meta_path, ".clean2")

# Verify both
for path in [root_path, meta_path]:
    data = open(path, "rb").read()
    print(f"\n{path}:")
    print(f"  Size: {len(data)}, has 0036: {b'0036' in data}")
    stored_crc = struct.unpack_from("<I", data, 4)[0]
    computed_crc = zlib.crc32(data[4:]) & 0xFFFFFFFF
    print(f"  CRC match: {stored_crc == computed_crc}")
