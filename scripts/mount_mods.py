import struct, sys, os, json, lz4.block

game_dir = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"
mods_dir = r"C:\Users\corin\Desktop\CD JSON Mod Manager\mods"
clean_path = r"C:\Users\corin\Desktop\CD JSON Mod Manager\backups\storeinfo_clean.bin"

# Step 1: Load clean storeinfo
data = bytearray(open(clean_path, "rb").read())
print(f"Clean storeinfo: {len(data)} bytes")

# Step 2: Apply ONLY these 2 mods
mod_files = ["999BackpackinShop.json", "ALL Craft Material Ventor Shop.json"]

total = 0
for mf in mod_files:
    mod = json.load(open(os.path.join(mods_dir, mf)))
    count = 0
    for patch in mod["patches"]:
        for change in patch["changes"]:
            off = change["offset"]
            orig = bytes.fromhex(change["original"])
            patched = bytes.fromhex(change["patched"])
            actual = data[off:off+len(orig)]
            if actual != orig:
                print(f"  CONFLICT {mf} offset {off}: expected {orig.hex()} got {actual.hex()}")
            data[off:off+len(patched)] = patched
            count += 1
    print(f"{mf}: {count} patches applied")
    total += count

print(f"Total: {total} patches")

# Verify
print(f"\nVerification:")
print(f"  Offset 407: {data[407:411].hex()} (should be e7030000)")
print(f"  Offset 169137: {data[169137:169141].hex()} (should be e7030000)")

# Step 3: LZ4 compress
compressed = lz4.block.compress(bytes(data), store_size=False)
padded_size = (len(compressed) + 15) & ~15
output = compressed + b"\x00" * (padded_size - len(compressed))
print(f"\nCompressed: {len(compressed)} bytes, padded: {padded_size}")

# Step 4: Write overlay PAZ
paz_path = os.path.join(game_dir, "0036", "0.paz")
open(paz_path, "wb").write(output)
print(f"Written to 0036/0.paz")

# Step 5: Update PAMT
pamt_path = os.path.join(game_dir, "0036", "0.pamt")
pamt = bytearray(open(pamt_path, "rb").read())
pamt[0x84:0x88] = struct.pack("<I", len(compressed))
pamt[0x88:0x8c] = struct.pack("<I", len(data))
pamt[0x14:0x18] = struct.pack("<I", padded_size)
open(pamt_path, "wb").write(pamt)
print(f"PAMT updated")

# Step 6: Verify PAPGT has 0036
papgt = open(os.path.join(game_dir, "meta", "0.papgt"), "rb").read()
print(f"PAPGT has 0036: {b'0036' in papgt}")

print(f"\nDone! Launch the game and check:")
print(f"  - Equipment shop in Hernand: should have craft materials (999 qty)")
print(f"  - Equipment shop: should sell 999 small backpacks")
