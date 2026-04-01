import struct, zlib, hashlib

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"
papgt = open(f"{game_dir}\\meta\\0.papgt", "rb").read()

stored_hash = struct.unpack_from("<I", papgt, 4)[0]
print(f"Target hash: 0x{stored_hash:08x}")

# The PAPGT has: [val0:4][hash:4][val2:4][entries...][names_len:4][names...]
# Let's try hashing different portions

# Build test data: everything except the hash field (bytes 4-8)
no_hash = papgt[:4] + papgt[8:]

# Also try: everything after header
after_header = papgt[12:]

# Also try: just entries + names (skip all 12 header bytes)
entries_and_names = papgt[12:]

# Custom CRC32 with different initial values
for init in [0, 0xFFFFFFFF, 0x12345678, 0xDEADBEEF, 0x04C11DB7]:
    crc = zlib.crc32(no_hash, init) & 0xFFFFFFFF
    if crc == stored_hash:
        print(f"MATCH! CRC32(no_hash, init=0x{init:08x}) = 0x{crc:08x}")

    crc2 = zlib.crc32(after_header, init) & 0xFFFFFFFF
    if crc2 == stored_hash:
        print(f"MATCH! CRC32(after_header, init=0x{init:08x}) = 0x{crc2:08x}")

# Try FNV-1a hash (common in game engines)
def fnv1a_32(data, offset=0x811c9dc5):
    h = offset
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h

for test_data, name in [(no_hash, "no_hash"), (after_header, "after_header"), (entries_and_names, "entries")]:
    h = fnv1a_32(test_data)
    if h == stored_hash:
        print(f"MATCH! FNV1a({name}) = 0x{h:08x}")
    h2 = fnv1a_32(test_data, 0)
    if h2 == stored_hash:
        print(f"MATCH! FNV1a({name}, init=0) = 0x{h2:08x}")

# Try MurmurHash-like
def simple_hash(data):
    h = 0
    for i, b in enumerate(data):
        h = ((h << 5) + h + b) & 0xFFFFFFFF
    return h

for test_data, name in [(no_hash, "no_hash"), (after_header, "after_header")]:
    h = simple_hash(test_data)
    if h == stored_hash:
        print(f"MATCH! SimpleHash({name}) = 0x{h:08x}")

# Try: maybe the hash is just the CRC32 of the entry data only (not header, not names)
names_start = papgt.find(b"0000\x00")
entries_only = papgt[12:names_start - 4]
names_only = papgt[names_start:]

for test_data, name in [(entries_only, "entries_only"), (names_only, "names_only")]:
    crc = zlib.crc32(test_data) & 0xFFFFFFFF
    if crc == stored_hash:
        print(f"MATCH! CRC32({name}) = 0x{crc:08x}")

# Pearl Abyss uses a custom hash in their PAZ format
# Let me try: XOR all 4-byte values together
def xor_hash(data):
    h = 0
    for i in range(0, len(data) - 3, 4):
        h ^= struct.unpack_from("<I", data, i)[0]
    return h

for test_data, name in [(no_hash, "no_hash"), (after_header, "after_header")]:
    h = xor_hash(test_data)
    if h == stored_hash:
        print(f"MATCH! XOR({name}) = 0x{h:08x}")

# Maybe the hash is from the PAVER file content?
paver = open(f"{game_dir}\\meta\\0.paver", "rb").read()
paver_crc = zlib.crc32(paver) & 0xFFFFFFFF
print(f"\nPAVER CRC32: 0x{paver_crc:08x} match={paver_crc == stored_hash}")

# Maybe the hash at offset 4 IS the paver hash/version
paver_val = struct.unpack_from("<I", paver, 4)[0]
print(f"PAVER val at offset 4: 0x{paver_val:08x} match={paver_val == stored_hash}")

# Try: maybe val0 is a size and hash is computed from file at that size
# val0 = 0x468 = 1128. Maybe it's file_size * 2?
# 577 * 2 = 1154... no
# Or: 12 + 33*12 + 4 + 165 = 577. 33*12 + 4 + 165 = 565.
# With 12-byte header excluded: 565

# Let me check the PATHC file
pathc = open(f"{game_dir}\\meta\\0.pathc", "rb").read()
pathc_hash = struct.unpack_from("<I", pathc, 0)[0]
print(f"PATHC first 4 bytes: 0x{pathc_hash:08x}")
# Check if PAPGT hash relates to PATHC
print(f"PATHC CRC32: 0x{zlib.crc32(pathc) & 0xFFFFFFFF:08x}")

# Try: maybe offset 4 in PAPGT is literally copied from somewhere else
# Check if the value appears in PATHC
pathc_match = pathc.find(struct.pack("<I", stored_hash))
print(f"Hash found in PATHC at: {pathc_match}")

# Check the game exe's CrimsonDesert.exe for this value
exe_path = f"{game_dir}\\bin64\\CrimsonDesert.exe"
exe_size = os.path.getsize(exe_path)
print(f"\nGame exe size: {exe_size}")
# The stored_hash might be derived from exe size or modification time
import os
stat = os.stat(exe_path)
print(f"Exe mtime: {stat.st_mtime}")
exe_size_hash = zlib.crc32(struct.pack("<Q", exe_size)) & 0xFFFFFFFF
print(f"CRC32(exe_size): 0x{exe_size_hash:08x} match={exe_size_hash == stored_hash}")

# From the original conversation, the state.json had:
# "game_version_id": "394088344:1774868621"
# 394088344 = 0x17800318... that's the exe size!
# And the version changed to "408361368:1774933409"
# 408361368 = 0x185AAD98
# Let's check current exe size
print(f"Current exe size: {exe_size} (0x{exe_size:08x})")

# The PAPGT hash might use the exe size as part of its computation!
