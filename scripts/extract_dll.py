import struct, zlib, os

exe_path = r"C:\Users\corin\Desktop\CD JSON Mod Manager\CD JSON Mod Manager.exe"

# The agent found the managed DLL at offset 8172544 (deflate-compressed)
# Let's extract it and look for hash/CRC functions

data = open(exe_path, "rb").read()
print(f"EXE size: {len(data)} bytes")

# Search for the .NET single-file bundle marker
# .NET single-file apps have a bundle header near the end
# with signature bytes and an offset to the bundle manifest

# Look for the bundle signature (8 bytes): 0x00 followed by specific pattern
# Actually, let's search for known .NET bundle signatures
# The bundle uses a specific magic at the end of the file

# Search from the end for the bundle header offset
# .NET 6 single-file bundle has the offset at (file_end - 8)
bundle_offset = struct.unpack_from("<Q", data, len(data) - 48)[0]
print(f"Potential bundle offset: {bundle_offset}")

# Try to find "CD JSON Mod Manager.dll" in the file
dll_name = b"CD JSON Mod Manager.dll"
pos = data.find(dll_name)
if pos >= 0:
    print(f"Found DLL name at offset: {pos}")
    # Look around for the entry with offset/size info
    # The bundle manifest has entries with: offset, size, compressed_size, type, name
    # Search backwards for the entry header
    for scan in range(max(0, pos - 200), pos):
        # Try reading as entry: [offset:8][size:8][compressed_size:8][type:1][name_length:?][name]
        try:
            off = struct.unpack_from("<Q", data, scan)[0]
            sz = struct.unpack_from("<Q", data, scan + 8)[0]
            comp_sz = struct.unpack_from("<Q", data, scan + 16)[0]
            if 100000 < sz < 5000000 and 100000 < comp_sz < 5000000 and off < len(data):
                # Check if name follows
                name_start = scan + 24 + 1  # +1 for type byte
                # Read name length (7-bit encoded)
                name_len = data[name_start]
                if name_len < 128:
                    name = data[name_start+1:name_start+1+name_len]
                    if b"JSON" in name or b"dll" in name:
                        print(f"  Possible entry at {scan}: offset={off}, size={sz}, comp={comp_sz}")
                        print(f"  Name: {name}")

                        # Try to extract
                        if comp_sz < sz:  # compressed
                            raw = data[off:off+comp_sz]
                            try:
                                decompressed = zlib.decompress(raw, -15)
                                print(f"  Decompressed: {len(decompressed)} bytes")
                                out_path = r"C:\Users\corin\Desktop\CD JSON Mod Manager\extracted_dll.dll"
                                open(out_path, "wb").write(decompressed)
                                print(f"  Saved to {out_path}")
                            except:
                                pass
        except:
            pass

# Alternative: search for MZ header (DLL starts with MZ)
print("\nSearching for embedded MZ headers...")
mz_positions = []
search_pos = 1000000  # Skip the main EXE header
while search_pos < len(data):
    pos = data.find(b"MZ", search_pos)
    if pos < 0:
        break
    # Check for PE signature nearby
    if pos + 0x40 < len(data):
        pe_offset = struct.unpack_from("<I", data, pos + 0x3C)[0]
        if pe_offset < 1000 and pos + pe_offset + 4 < len(data):
            pe_sig = data[pos + pe_offset:pos + pe_offset + 4]
            if pe_sig == b"PE\x00\x00":
                mz_positions.append(pos)
                if len(mz_positions) <= 3:
                    print(f"  PE DLL at offset {pos}")
    search_pos = pos + 1

# Also try: the .NET IL metadata might be searchable
# Look for "#Strings" heap which contains method names
strings_pos = data.find(b"#Strings")
if strings_pos >= 0:
    print(f"\n#Strings heap found at {strings_pos}")
    # Search for hash-related method names near this area
    for keyword in [b"CalcHash", b"ComputeHash", b"papgt", b"PAPGT", b"PatchGroup", b"HashGroup"]:
        kpos = data.find(keyword)
        if kpos >= 0:
            context = data[max(0,kpos-20):kpos+len(keyword)+20]
            safe = ''.join(chr(b) if 32 <= b < 127 else '.' for b in context)
            print(f"  Found '{keyword.decode()}' at {kpos}: ...{safe}...")
