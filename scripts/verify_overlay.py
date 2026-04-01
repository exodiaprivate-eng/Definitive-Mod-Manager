import struct, json, os, lz4.block

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

# Read current overlay
paz = open(os.path.join(game_dir, "0036", "0.paz"), "rb").read()
pamt = open(os.path.join(game_dir, "0036", "0.pamt"), "rb").read()

comp_size = struct.unpack_from("<I", pamt, 0x84)[0]
uncomp_size = struct.unpack_from("<I", pamt, 0x88)[0]
paz_file_size = struct.unpack_from("<I", pamt, 0x14)[0]

print(f"PAZ file: {len(paz)} bytes")
print(f"PAMT compressed_size: {comp_size}")
print(f"PAMT uncompressed_size: {uncomp_size}")
print(f"PAMT paz_file_size: {paz_file_size}")
print(f"Sizes match: comp={comp_size <= len(paz)}, uncomp={uncomp_size == 490814}")

# Try decompressing
try:
    data = lz4.block.decompress(paz[:comp_size], uncompressed_size=uncomp_size)
    print(f"\nDecompressed: {len(data)} bytes")

    # Check mod patches
    mods_dir = r"C:\Users\corin\Desktop\CD JSON Mod Manager\mods"

    for mf in ["999BackpackinShop.json", "ALL Craft Material Ventor Shop.json"]:
        mod = json.load(open(os.path.join(mods_dir, mf)))
        applied = 0
        original = 0
        neither = 0
        for patch in mod["patches"]:
            for change in patch["changes"]:
                off = change["offset"]
                orig_hex = change["original"].lower()
                patched_hex = change["patched"].lower()
                blen = len(patched_hex) // 2
                actual = data[off:off+blen].hex()
                if actual == patched_hex:
                    applied += 1
                elif actual == orig_hex:
                    original += 1
                else:
                    neither += 1
        total = applied + original + neither
        print(f"\n{mf}:")
        print(f"  PATCHED: {applied}/{total}")
        print(f"  ORIGINAL: {original}/{total}")
        print(f"  NEITHER: {neither}/{total}")

except Exception as e:
    print(f"\nDecompression FAILED: {e}")
    print("The LZ4 data in the overlay might be in wrong format")

    # Try the other way: maybe lz4_flex writes with size prefix
    try:
        # lz4_flex::block::compress adds NO size prefix by default
        # but let's try skipping first 4 bytes in case it did
        data2 = lz4.block.decompress(paz[4:comp_size], uncompressed_size=uncomp_size)
        print(f"Decompressed (skip 4): {len(data2)} bytes")
    except Exception as e2:
        print(f"Skip 4 also failed: {e2}")

# Also check: is the PAZ actually what we wrote, or did the Rust app overwrite it?
print(f"\nPAZ first 16 bytes: {paz[:16].hex()}")
print(f"PAZ last 16 bytes: {paz[-16:].hex()}")
