import struct, zlib, os, sys

exe_path = r"C:\Users\corin\Desktop\CD JSON Mod Manager\CD JSON Mod Manager.exe"
data = open(exe_path, "rb").read()

# .NET 6 single-file bundles have a header at a known location
# The bundle header signature is at the end of the file
# Format: [bundleHeaderOffset:8] at (filesize - 8 - 20)
# Or search for the bundle signature

# .NET single-file bundle v2 signature:
# 8 bytes of zeros followed by specific pattern
# Let me search for the bundle manifest

# The deps.json we extracted earlier mentioned the app targets .NET 6
# Single-file bundles have a 64-byte header at a discoverable offset

# Search for bundle signature from end of file
# Bundle header v6 has: [majorVersion:4][minorVersion:4][numFiles:4][bundleID:varies]

# Actually, let me search for the managed DLL by looking for the .NET metadata
# PE/COFF with .NET metadata has the CLI header

# Search for compressed data blocks - the DLL might be deflate-compressed
# in the single-file bundle

# The agent said: "Embedded in exe at offset 8172544 (deflate-compressed, 471,486 -> 1,423,360 bytes)"
offset = 8172544
comp_size = 471486
decomp_size = 1423360

print(f"Trying extraction at offset {offset}, comp_size={comp_size}")

raw = data[offset:offset + comp_size]
try:
    dll = zlib.decompress(raw)
    print(f"Zlib decompressed: {len(dll)} bytes")
except:
    try:
        dll = zlib.decompress(raw, -15)
        print(f"Deflate decompressed: {len(dll)} bytes")
    except:
        # Try scanning nearby offsets
        print("Direct extraction failed, scanning...")
        dll = None
        for scan_offset in range(offset - 1000, offset + 1000):
            for try_size in range(comp_size - 100, comp_size + 100):
                try:
                    test = data[scan_offset:scan_offset + try_size]
                    result = zlib.decompress(test, -15)
                    if len(result) > 1000000:
                        print(f"Found at offset {scan_offset}, comp={try_size}, decomp={len(result)}")
                        dll = result
                        break
                except:
                    pass
            if dll:
                break

if dll is None:
    # Try a different approach: search for MZ header preceded by size fields
    print("\nSearching for embedded DLL via size markers...")
    # In .NET single-file, each entry has: [offset:8][size:8][compressedSize:8][type:1]
    # The DLL name "CD JSON Mod Manager.dll" was at offset 7835856

    # Look near that offset for the entry header
    name_offset = 7835856
    # Entry might be: [fileOffset:8][fileSize:8][compressedSize:8][type:1][relativePath]
    # Search backwards from the name for plausible offset/size pairs
    for back in range(8, 200, 4):
        test_off = name_offset - back
        file_off = struct.unpack_from("<Q", data, test_off)[0]
        file_size = struct.unpack_from("<Q", data, test_off + 8)[0]
        comp_size = struct.unpack_from("<Q", data, test_off + 16)[0]

        if 0 < file_off < len(data) and 0 < file_size < 10000000 and 0 < comp_size < 10000000:
            if comp_size <= file_size:  # compressed should be <= uncompressed
                print(f"  back={back}: offset={file_off}, size={file_size}, comp={comp_size}")

                # Try extraction
                raw = data[file_off:file_off + comp_size]
                try:
                    result = zlib.decompress(raw, -15)
                    if len(result) > 100000:
                        print(f"  SUCCESS! Decompressed {len(result)} bytes")
                        dll = result

                        # Save it
                        out_path = r"C:\Users\corin\Desktop\CD JSON Mod Manager\extracted.dll"
                        open(out_path, "wb").write(dll)
                        print(f"  Saved to {out_path}")

                        # Check if it's a valid PE
                        if dll[:2] == b"MZ":
                            print("  Valid PE/DLL!")
                        break
                except:
                    pass

if dll and len(dll) > 10000:
    # Search for hash-related strings in the DLL
    print("\nSearching for hash-related code...")
    for keyword in [b"papgt", b"PAPGT", b"PatchGroup", b"CalcHash", b"ComputeHash",
                    b"HeaderCrc", b"PlatformMagic", b"CalcCrc", b"HashAll",
                    b"crc32", b"CRC32", b"Crc32", b"ComputeCrc"]:
        pos = 0
        while True:
            pos = dll.find(keyword, pos)
            if pos < 0:
                break
            context = dll[max(0,pos-20):pos+len(keyword)+40]
            safe = ''.join(chr(b) if 32 <= b < 127 else '.' for b in context)
            print(f"  Found '{keyword.decode()}' at {pos}: {safe}")
            pos += 1
