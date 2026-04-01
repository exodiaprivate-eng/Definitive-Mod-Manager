import json, os, lz4.block, struct

# Compare our "clean" storeinfo against what we get from a fresh decompression
# of the original overlay

backup_dir = r"C:\Users\corin\Desktop\CD JSON Mod Manager\backups"
clean = open(os.path.join(backup_dir, "storeinfo_clean.bin"), "rb").read()
print(f"storeinfo_clean.bin: {len(clean)} bytes")

# Count store names in the clean data
store_count = clean.count(b"Store_")
print(f"Store names found: {store_count}")

# Find all stores
pos = 0
stores = []
while pos < len(clean):
    idx = clean.find(b"Store_", pos)
    if idx < 0:
        break
    end = clean.find(b"\x00", idx)
    if end > 0 and end - idx < 80:
        try:
            name = clean[idx:end].decode("ascii")
            stores.append((idx, name))
        except:
            pass
    pos = idx + 1

print(f"Store entries: {len(stores)}")
for idx, name in stores[:10]:
    print(f"  {idx}: {name}")

# The critical question: is offset 407 actually in Store_Her_General's data?
# Store_Her_General should be the first store
# Check what's around offset 407
print(f"\nData around offset 407:")
for off in [400, 407, 410, 415, 420, 423, 430]:
    val = clean[off:off+4].hex()
    print(f"  Offset {off}: {val}")

# Check: how does this data start?
print(f"\nFirst 64 bytes of clean data:")
print(f"  {clean[:64].hex()}")
ascii_start = ''.join(chr(b) if 32 <= b < 127 else '.' for b in clean[:64])
print(f"  {ascii_start}")

# Now the KEY test: unmount everything (restore original overlay)
# and check if the original overlay has the EXPECTED original values
# The original mod manager's backup of the overlay should have clean data

# Actually let's check: does the GAME's own 0036 (from before ANY mods)
# have the same data? We need to verify game integrity.

# Let me check: after Steam verify + our storeinfo_clean reversal,
# what values are at the critical offsets?
mods_dir = r"C:\Users\corin\Desktop\CD JSON Mod Manager\mods"
mod = json.load(open(os.path.join(mods_dir, "ALL Craft Material Ventor Shop.json")))

# Check first 5 patches
print("\nFirst 5 patches from ALL Craft Material:")
for change in mod["patches"][0]["changes"][:5]:
    off = change["offset"]
    orig = change["original"].lower()
    label = change["label"]
    actual = clean[off:off+4].hex()
    print(f"  {label}: offset={off}, clean={actual}, expected_orig={orig}, match={actual==orig}")

# Check 999BackpackinShop
mod2 = json.load(open(os.path.join(mods_dir, "999BackpackinShop.json")))
for change in mod2["patches"][0]["changes"]:
    off = change["offset"]
    orig = change["original"].lower()
    actual = clean[off:off+4].hex()
    print(f"\n  999Backpack: offset={off}, clean={actual}, expected_orig={orig}, match={actual==orig}")
