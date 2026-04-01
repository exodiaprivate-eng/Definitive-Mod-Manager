import struct, binascii, zlib

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

# We have the hex dump of the WORKING modded PAPGT from earlier:
# 6004 0000 c4d1 4040 2202 0000 ...
# And the CLEAN PAPGT:
# 6004 0000 1aab b7c9 2102 0000 ...
#
# offset 0: same (0x00000460)
# offset 4: HASH that changes
# offset 8: entry count (0x221 clean -> 0x222 modded)
#
# The hash at offset 4 might be CRC32 of the data AFTER the hash field
# Or CRC32 of the whole file excluding the hash field
# Or something else

clean = open(f"{game_dir}\\meta\\0.papgt", "rb").read()
print(f"Clean PAPGT: {len(clean)} bytes")

stored_hash = struct.unpack_from("<I", clean, 4)[0]
print(f"Stored hash: 0x{stored_hash:08x}")

# Try CRC32 of everything except bytes 4-8
test_data = clean[:4] + clean[8:]
crc = zlib.crc32(test_data) & 0xFFFFFFFF
print(f"CRC32(data without hash field): 0x{crc:08x} match={crc == stored_hash}")

# Try CRC32 of just the data after the hash
test_data2 = clean[8:]
crc2 = zlib.crc32(test_data2) & 0xFFFFFFFF
print(f"CRC32(data after hash): 0x{crc2:08x} match={crc2 == stored_hash}")

# Try CRC32 of everything after header (12 bytes)
test_data3 = clean[12:]
crc3 = zlib.crc32(test_data3) & 0xFFFFFFFF
print(f"CRC32(data after 12-byte header): 0x{crc3:08x} match={crc3 == stored_hash}")

# Try with 0 in the hash field position
test_data4 = clean[:4] + b"\x00\x00\x00\x00" + clean[8:]
crc4 = zlib.crc32(test_data4) & 0xFFFFFFFF
print(f"CRC32(zeroed hash field): 0x{crc4:08x} match={crc4 == stored_hash}")

# Try Adler32
adl = zlib.adler32(test_data) & 0xFFFFFFFF
print(f"Adler32(no hash): 0x{adl:08x} match={adl == stored_hash}")

# Maybe it's a FNV hash or custom hash
# Let me try: maybe it's NOT a checksum of the data, but a version/content hash
# that the game uses to detect changes
#
# If so, maybe we can just set it to anything and the game only checks
# the file structure, not the hash?
#
# OR: maybe the game doesn't validate the hash at all - the error might
# be from something else entirely (like our entry format being wrong)

# Let me check if the error is from PAPGT or from the overlay data
# by checking with a CLEAN papgt + the overlay that exists
print(f"\nDoes 0036 folder exist: {__import__('os').path.isdir(f'{game_dir}/0036')}")
print(f"0036/0.paz size: {__import__('os').path.getsize(f'{game_dir}/0036/0.paz')}")

# Maybe the game errors because 0036 EXISTS as a folder but ISN'T in the PAPGT?
# Let me test: rename 0036 temporarily, game should work clean
