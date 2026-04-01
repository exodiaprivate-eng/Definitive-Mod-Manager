"""
PAMT Parser - Crimson Desert Archive Index Reader

Parses PAMT (PA Meta Table) files to find any file across all game groups.
Based on the decompiled PamtPatcher class from CD JSON Mod Manager.

PAMT Structure:
  [HeaderCrc:4]           - PaChecksum of everything after byte 12
  [PazCount:4]            - Number of PAZ entries (always 1 for each group)
  [Unknown:4]             - Version/magic (0x610E0232 typically)
  --- PazInfo entries (12 bytes each) ---
  [Index:4][Crc:4][FileSize:4]
  --- Directory block ---
  [DirBlockSize:4][DirData...]   - Linked-list tree of directory name segments
  --- Filename block ---
  [FnBlockSize:4][FnData...]     - Linked-list tree of filename segments
  --- Hash table ---
  [HashCount:4] then HashEntries of 16 bytes each:
    [FolderHash:4][NameOffset:4][FileStartIndex:4][FileCount:4]
  --- File records ---
  [FileCount:4] then FileRecords of 20 bytes each:
    [NameOffset:4][PazOffset:4][CompSize:4][DecompSize:4][PazIndex:2][Flags:2]

Name resolution: Both dir and filename blocks use a linked-list format:
  [ParentOffset:4][NameLen:1][NameBytes:NameLen]
  ParentOffset = 0xFFFFFFFF means root (no parent).
  Walk parent chain, collect segments, reverse to get full path.

Usage:
  python parse_pamt.py                          # Scan all groups for all .pabgb files
  python parse_pamt.py --search inventory.pabgb # Search for specific file
  python parse_pamt.py --group 0007             # Parse single group
  python parse_pamt.py --dump 0007              # Dump all files in a group
  python parse_pamt.py --extract inventory.pabgb --output extracted.bin  # Extract a file
"""

import struct
import sys
import os
import argparse


# ============================================================
# PaChecksum - exact port from decompiled C#
# ============================================================

PA_MAGIC = 558228019  # 0x21476E33

def rotl(v, n):
    v &= 0xFFFFFFFF
    return ((v << n) | (v >> (32 - n))) & 0xFFFFFFFF

def rotr(v, n):
    v &= 0xFFFFFFFF
    return ((v >> n) | (v << (32 - n))) & 0xFFFFFFFF

def u32(x):
    return x & 0xFFFFFFFF

def pa_checksum(data):
    """Port of PaChecksum.Compute from decompiled C#."""
    if isinstance(data, (bytearray, memoryview)):
        data = bytes(data)
    length = len(data)
    if length == 0:
        return 0

    a = b = c = u32(length - PA_MAGIC)
    pos = 0
    remaining = length

    while remaining > 12:
        a = u32(a + struct.unpack_from('<I', data, pos)[0])
        b = u32(b + struct.unpack_from('<I', data, pos + 4)[0])
        c = u32(c + struct.unpack_from('<I', data, pos + 8)[0])

        a = u32(a - c); a ^= rotl(c, 4);  c = u32(c + b)
        b = u32(b - a); b ^= rotl(a, 6);  a = u32(a + c)
        c = u32(c - b); c ^= rotl(b, 8);  b = u32(b + a)
        a = u32(a - c); a ^= rotl(c, 16); c = u32(c + b)
        b = u32(b - a); b ^= rotl(a, 19); a = u32(a + c)
        c = u32(c - b); c ^= rotl(b, 4);  b = u32(b + a)

        pos += 12
        remaining -= 12

    # Handle remaining bytes
    if remaining >= 12: c = u32(c + (data[pos + 11] << 24))
    if remaining >= 11: c = u32(c + (data[pos + 10] << 16))
    if remaining >= 10: c = u32(c + (data[pos + 9] << 8))
    if remaining >= 9:  c = u32(c + data[pos + 8])
    if remaining >= 8:  b = u32(b + (data[pos + 7] << 24))
    if remaining >= 7:  b = u32(b + (data[pos + 6] << 16))
    if remaining >= 6:  b = u32(b + (data[pos + 5] << 8))
    if remaining >= 5:  b = u32(b + data[pos + 4])
    if remaining >= 4:  a = u32(a + (data[pos + 3] << 24))
    if remaining >= 3:  a = u32(a + (data[pos + 2] << 16))
    if remaining >= 2:  a = u32(a + (data[pos + 1] << 8))
    if remaining >= 1:  a = u32(a + data[pos])

    # Final mixing
    n6 = u32(u32(b ^ c) - rotl(b, 14))
    n7 = u32(u32(a ^ n6) - rotl(n6, 11))
    n8 = u32(u32(n7 ^ b) - rotr(n7, 7))
    n9 = u32(u32(n8 ^ n6) - rotl(n8, 16))
    n10 = rotl(n9, 4)
    n11 = u32(u32(n7 ^ n9) - n10)
    n12 = u32(u32(n11 ^ n8) - rotl(n11, 14))
    return u32(u32(n12 ^ n9) - rotr(n12, 8))


# ============================================================
# ChaCha20 decryption - port from decompiled CryptoHelper
# ============================================================

HASH_INITVAL = 810718
IV_XOR = 0x60616263
XOR_DELTAS = [0, 168430090, 202116108, 101058054, 235802126, 168430090, 101058054, 33686018]

def hashlittle(data, initval):
    """Port of CryptoHelper.Hashlittle (Jenkins hash)."""
    length = len(data)
    a = b = c = u32(0xDEADBEEF + length + initval)
    pos = 0
    remaining = length
    while remaining > 12:
        a = u32(a + struct.unpack_from('<I', data, pos)[0])
        b = u32(b + struct.unpack_from('<I', data, pos + 4)[0])
        c = u32(c + struct.unpack_from('<I', data, pos + 8)[0])
        a = u32(a - c); a ^= rotl(c, 4);  c = u32(c + b)
        b = u32(b - a); b ^= rotl(a, 6);  a = u32(a + c)
        c = u32(c - b); c ^= rotl(b, 8);  b = u32(b + a)
        a = u32(a - c); a ^= rotl(c, 16); c = u32(c + b)
        b = u32(b - a); b ^= rotl(a, 19); a = u32(a + c)
        c = u32(c - b); c ^= rotl(b, 4);  b = u32(b + a)
        pos += 12
        remaining -= 12
    if remaining >= 12: c = u32(c + (data[pos + 11] << 24))
    if remaining >= 11: c = u32(c + (data[pos + 10] << 16))
    if remaining >= 10: c = u32(c + (data[pos + 9] << 8))
    if remaining >= 9:  c = u32(c + data[pos + 8])
    if remaining >= 8:  b = u32(b + (data[pos + 7] << 24))
    if remaining >= 7:  b = u32(b + (data[pos + 6] << 16))
    if remaining >= 6:  b = u32(b + (data[pos + 5] << 8))
    if remaining >= 5:  b = u32(b + data[pos + 4])
    if remaining >= 4:  a = u32(a + (data[pos + 3] << 24))
    if remaining >= 3:  a = u32(a + (data[pos + 2] << 16))
    if remaining >= 2:  a = u32(a + (data[pos + 1] << 8))
    if remaining >= 1:  a = u32(a + data[pos])
    n6 = u32(u32(b ^ c) - rotl(b, 14))
    n7 = u32(u32(a ^ n6) - rotl(n6, 11))
    n8 = u32(u32(n7 ^ b) - rotr(n7, 7))
    n9 = u32(u32(n8 ^ n6) - rotl(n8, 16))
    n10 = rotl(n9, 4)
    n11 = u32(u32(n7 ^ n9) - n10)
    n12 = u32(u32(n11 ^ n8) - rotl(n11, 14))
    return u32(u32(n12 ^ n9) - rotr(n12, 8))


def chacha20_quarter_round(state, a, b, c, d):
    state[a] = u32(state[a] + state[b]); state[d] ^= state[a]; state[d] = rotl(state[d], 16)
    state[c] = u32(state[c] + state[d]); state[b] ^= state[c]; state[b] = rotl(state[b], 12)
    state[a] = u32(state[a] + state[b]); state[d] ^= state[a]; state[d] = rotl(state[d], 8)
    state[c] = u32(state[c] + state[d]); state[b] ^= state[c]; state[b] = rotl(state[b], 7)


def chacha20_block(key, counter, nonce):
    state = [
        0x61707865, 0x3320646E, 0x79622D32, 0x6B206574,
        key[0], key[1], key[2], key[3],
        key[4], key[5], key[6], key[7],
        counter, nonce[0], nonce[1], nonce[2]
    ]
    working = list(state)
    for _ in range(10):
        chacha20_quarter_round(working, 0, 4, 8, 12)
        chacha20_quarter_round(working, 1, 5, 9, 13)
        chacha20_quarter_round(working, 2, 6, 10, 14)
        chacha20_quarter_round(working, 3, 7, 11, 15)
        chacha20_quarter_round(working, 0, 5, 10, 15)
        chacha20_quarter_round(working, 1, 6, 11, 12)
        chacha20_quarter_round(working, 2, 7, 8, 13)
        chacha20_quarter_round(working, 3, 4, 9, 14)
    out = bytearray()
    for i in range(16):
        out += struct.pack('<I', u32(working[i] + state[i]))
    return out


def decrypt_chacha20(data, filename):
    """Decrypt ChaCha20-encrypted data using filename-derived key."""
    basename = os.path.basename(filename).lower()
    h = hashlittle(basename.encode('utf-8'), HASH_INITVAL)
    iv = h ^ IV_XOR
    key = [u32(iv ^ d) for d in XOR_DELTAS]
    nonce = [h, h, h]
    counter = h

    result = bytearray(len(data))
    pos = 0
    while pos < len(data):
        block = chacha20_block(key, counter, nonce)
        chunk_size = min(64, len(data) - pos)
        for j in range(chunk_size):
            result[pos + j] = data[pos + j] ^ block[j]
        pos += chunk_size
        counter = u32(counter + 1)
    return bytes(result)


def is_encrypted(flags):
    return (flags >> 4) != 0


def get_encryption_type(flags):
    return flags >> 4


def decrypt_if_needed(data, flags, filename):
    enc_type = get_encryption_type(flags)
    if enc_type == 0:
        return data
    elif enc_type == 3:
        return decrypt_chacha20(data, filename)
    else:
        raise ValueError(f"Unsupported encryption type {enc_type} (flags=0x{flags:04X}) for '{filename}'")


# ============================================================
# PAMT Parser
# ============================================================

class PamtInfo:
    def __init__(self):
        self.raw = b''
        self.header_crc = 0
        self.paz_count = 0
        self.unknown = 0
        self.paz_infos = []      # list of (index, crc, file_size)
        self.paz_info_end = 0
        self.dir_block_offset = 0
        self.dir_block_size = 0
        self.dir_data = b''
        self.fn_block_offset = 0
        self.fn_block_size = 0
        self.fn_data = b''
        self.hash_table_offset = 0
        self.hash_count = 0
        self.hash_entries = []   # list of (folder_hash, name_offset, file_start_index, file_count)
        self.file_records_offset = 0
        self.file_count = 0
        self.file_records = []   # list of (name_offset, paz_offset, comp_size, decomp_size, paz_index, flags, byte_offset)


def read_pamt(data):
    """Parse a PAMT file. Exact port of PamtPatcher.ReadPamtRaw."""
    info = PamtInfo()
    info.raw = data
    info.header_crc = struct.unpack_from('<I', data, 0)[0]
    info.paz_count = struct.unpack_from('<I', data, 4)[0]
    info.unknown = struct.unpack_from('<I', data, 8)[0]

    pos = 12
    for _ in range(info.paz_count):
        idx = struct.unpack_from('<I', data, pos)[0]
        crc = struct.unpack_from('<I', data, pos + 4)[0]
        fsize = struct.unpack_from('<I', data, pos + 8)[0]
        info.paz_infos.append((idx, crc, fsize))
        pos += 12
    info.paz_info_end = pos

    # Directory block
    dir_size = struct.unpack_from('<I', data, pos)[0]
    info.dir_block_offset = pos
    info.dir_block_size = dir_size
    info.dir_data = data[pos + 4 : pos + 4 + dir_size]
    pos += 4 + dir_size

    # Filename block
    fn_size = struct.unpack_from('<I', data, pos)[0]
    info.fn_block_offset = pos
    info.fn_block_size = fn_size
    info.fn_data = data[pos + 4 : pos + 4 + fn_size]
    pos += 4 + fn_size

    # Hash table
    hash_count = struct.unpack_from('<I', data, pos)[0]
    info.hash_table_offset = pos
    info.hash_count = hash_count
    pos += 4
    for _ in range(hash_count):
        folder_hash = struct.unpack_from('<I', data, pos)[0]
        name_offset = struct.unpack_from('<I', data, pos + 4)[0]
        file_start = struct.unpack_from('<I', data, pos + 8)[0]
        file_count = struct.unpack_from('<I', data, pos + 12)[0]
        info.hash_entries.append((folder_hash, name_offset, file_start, file_count))
        pos += 16

    # File records
    file_count = struct.unpack_from('<I', data, pos)[0]
    info.file_records_offset = pos
    info.file_count = file_count
    pos += 4
    for _ in range(file_count):
        name_off = struct.unpack_from('<I', data, pos)[0]
        paz_off = struct.unpack_from('<I', data, pos + 4)[0]
        comp_size = struct.unpack_from('<I', data, pos + 8)[0]
        decomp_size = struct.unpack_from('<I', data, pos + 12)[0]
        paz_index = struct.unpack_from('<H', data, pos + 16)[0]
        flags = struct.unpack_from('<H', data, pos + 18)[0]
        info.file_records.append({
            'name_offset': name_off,
            'paz_offset': paz_off,
            'comp_size': comp_size,
            'decomp_size': decomp_size,
            'paz_index': paz_index,
            'flags': flags,
            'byte_offset': pos
        })
        pos += 20

    return info


def resolve_name(block_data, name_offset):
    """
    Resolve a name from a linked-list name block (dir or filename).
    Each entry: [ParentOffset:4][NameLen:1][NameBytes:NameLen]
    ParentOffset = 0xFFFFFFFF means root.
    Walk parent chain, collect segments, reverse.
    """
    segments = []
    offset = name_offset
    guard = 0
    while offset != 0xFFFFFFFF and guard < 64:
        if offset + 5 > len(block_data):
            break
        parent = struct.unpack_from('<I', block_data, offset)[0]
        name_len = block_data[offset + 4]
        if offset + 5 + name_len > len(block_data):
            break
        seg = block_data[offset + 5 : offset + 5 + name_len].decode('utf-8', errors='replace')
        segments.append(seg)
        offset = parent
        guard += 1
    segments.reverse()
    return ''.join(segments)


def build_file_index(pamt_info):
    """
    Build a dict of full_path -> file_record for all files in this PAMT.
    Returns: dict mapping "dir/filename" -> record dict
    """
    index = {}
    dir_data = pamt_info.dir_data
    fn_data = pamt_info.fn_data

    # Build folder hash -> dirname mapping
    dir_names = {}
    for (folder_hash, name_offset, file_start, file_count) in pamt_info.hash_entries:
        dir_names[folder_hash] = resolve_name(dir_data, name_offset)

    # Map each file record to its directory
    for i, rec in enumerate(pamt_info.file_records):
        filename = resolve_name(fn_data, rec['name_offset'])
        # Find which hash entry owns this file record
        for (folder_hash, name_offset, file_start, file_count) in pamt_info.hash_entries:
            if file_start <= i < file_start + file_count:
                dirname = dir_names[folder_hash]
                if dirname:
                    full_path = dirname + '/' + filename
                else:
                    full_path = filename
                index[full_path] = rec
                break

    return index


def find_file(pamt_info, target):
    """Search for a file by name (can be partial or full path)."""
    idx = build_file_index(pamt_info)
    results = []
    target_lower = target.lower()
    for path, rec in idx.items():
        if target_lower in path.lower():
            results.append((path, rec))
    return results


# ============================================================
# Extraction
# ============================================================

def extract_file(game_dir, group_id, record, filename):
    """
    Extract a file from its PAZ archive.
    Returns the decompressed, decrypted data.
    """
    import lz4.block

    paz_path = os.path.join(game_dir, group_id, "0.paz")
    if not os.path.exists(paz_path):
        raise FileNotFoundError(f"PAZ not found: {paz_path}")

    comp_size = record['comp_size']
    decomp_size = record['decomp_size']
    paz_offset = record['paz_offset']
    flags = record['flags']

    print(f"  PAZ file: {paz_path}")
    print(f"  Offset: {paz_offset} (0x{paz_offset:X})")
    print(f"  Compressed size: {comp_size}")
    print(f"  Decompressed size: {decomp_size}")
    print(f"  Flags: 0x{flags:04X} (encryption type: {flags >> 4}, compression bits: {flags & 0xF})")

    with open(paz_path, 'rb') as f:
        f.seek(paz_offset)
        raw = f.read(comp_size)

    if len(raw) != comp_size:
        raise ValueError(f"Short read: got {len(raw)} bytes, expected {comp_size}")

    # Step 1: Decrypt if needed
    if is_encrypted(flags):
        print(f"  Decrypting (ChaCha20, type {flags >> 4})...")
        raw = decrypt_if_needed(raw, flags, filename)

    # Step 2: Decompress if needed
    if comp_size != decomp_size:
        print(f"  Decompressing (LZ4)...")
        decompressed = lz4.block.decompress(raw, uncompressed_size=decomp_size)
        return decompressed
    else:
        print(f"  No compression needed (sizes match)")
        return raw


# ============================================================
# Multi-file overlay PAMT builder
# ============================================================

def build_multi_pamt(files, paz_data_len):
    """
    Build a PAMT for an overlay with multiple files.
    Port of ModManager.BuildMultiPamt from decompiled C#.

    files: list of dicts with keys:
        dir_path: str  (e.g. "gamedata/binary__/client/bin")
        filename: str  (e.g. "storeinfo.pabgb")
        paz_offset: int
        comp_size: int
        decomp_size: int
        flags: int (default 0x0002)

    paz_data_len: total size of the PAZ data file

    Returns: bytes of the complete PAMT
    """
    # ---- Build directory block ----
    dir_block = bytearray()
    dir_offsets = {}  # "path/segment" -> offset in dir_block

    all_dirs = sorted(set(f['dir_path'] for f in files))
    for dir_path in all_dirs:
        parts = dir_path.split('/')
        for depth in range(len(parts)):
            key = '/'.join(parts[:depth + 1])
            if key not in dir_offsets:
                offset_in_block = len(dir_block)
                dir_offsets[key] = offset_in_block
                if depth == 0:
                    parent_offset = 0xFFFFFFFF
                    segment = parts[depth]
                else:
                    parent_key = '/'.join(parts[:depth])
                    parent_offset = dir_offsets[parent_key]
                    segment = '/' + parts[depth]
                seg_bytes = segment.encode('utf-8')
                dir_block += struct.pack('<I', parent_offset)
                dir_block.append(len(seg_bytes))
                dir_block += seg_bytes

    # ---- Build filename block + hash entries + file records ----
    fn_block = bytearray()
    hash_entries_data = []
    file_records_data = []

    # Group files by directory (sorted)
    from collections import OrderedDict
    grouped = OrderedDict()
    for f in files:
        if f['dir_path'] not in grouped:
            grouped[f['dir_path']] = []
        grouped[f['dir_path']].append(f)

    file_idx = 0
    for dir_path, dir_files in sorted(grouped.items()):
        folder_hash = pa_checksum(dir_path.encode('utf-8'))
        dir_name_offset = dir_offsets[dir_path]
        start_index = file_idx

        for f in dir_files:
            fn_offset = len(fn_block)
            # Filename entry: [parent:4][len:1][name_bytes]
            fn_bytes = f['filename'].encode('utf-8')
            fn_block += struct.pack('<I', 0xFFFFFFFF)  # no parent for filenames
            fn_block.append(len(fn_bytes))
            fn_block += fn_bytes

            # File record: [NameOff:4][PazOff:4][CompSize:4][DecompSize:4][PazIndex:2][Flags:2]
            file_records_data.append(struct.pack('<IIIIHH',
                fn_offset,
                f['paz_offset'],
                f['comp_size'],
                f['decomp_size'],
                0,  # paz_index always 0 for overlay
                f.get('flags', 0x0002)
            ))
            file_idx += 1

        # Hash entry: [FolderHash:4][NameOffset:4][FileStartIndex:4][FileCount:4]
        hash_entries_data.append(struct.pack('<IIII',
            folder_hash,
            dir_name_offset,
            start_index,
            len(dir_files)
        ))

    # ---- Assemble PAMT ----
    # Inner PAMT (before HeaderCrc)
    inner = bytearray()
    inner += struct.pack('<I', 1)            # PazCount = 1
    inner += struct.pack('<I', 0x610E0232)   # Unknown/magic  (1628308018)
    inner += struct.pack('<I', 0)            # PazInfo: Index = 0
    inner += struct.pack('<I', 0)            # PazInfo: Crc = 0 (filled later)
    inner += struct.pack('<I', paz_data_len) # PazInfo: FileSize

    # Dir block
    dir_bytes = bytes(dir_block)
    inner += struct.pack('<I', len(dir_bytes))
    inner += dir_bytes

    # Filename block
    fn_bytes = bytes(fn_block)
    inner += struct.pack('<I', len(fn_bytes))
    inner += fn_bytes

    # Hash entries
    inner += struct.pack('<I', len(hash_entries_data))
    for h in hash_entries_data:
        inner += h

    # File records
    inner += struct.pack('<I', len(file_records_data))
    for r in file_records_data:
        inner += r

    # Compute HeaderCrc over inner data starting at byte 8 (skip PazCount + Unknown)
    # Actually from decompiled code: crc is over array4[8:] where array4 starts at PazCount
    # So crc covers: Unknown + PazInfos + DirBlock + FnBlock + HashTable + FileRecords
    header_crc = pa_checksum(inner[8:])

    # Final PAMT: [HeaderCrc:4][inner...]
    pamt = struct.pack('<I', header_crc) + bytes(inner)
    return pamt


# ============================================================
# Main CLI
# ============================================================

GAME_DIR = r"C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"

def get_all_groups(game_dir):
    """Get all numeric group directories (excluding 0036 overlay)."""
    groups = []
    try:
        for d in os.listdir(game_dir):
            full = os.path.join(game_dir, d)
            if os.path.isdir(full) and d.isdigit() and d != '0036':
                pamt_path = os.path.join(full, '0.pamt')
                if os.path.exists(pamt_path):
                    groups.append(d)
    except Exception as e:
        print(f"Error listing game dir: {e}")
    groups.sort()
    return groups


def dump_group(game_dir, group_id, verbose=False):
    """Parse and display all files in a group's PAMT."""
    pamt_path = os.path.join(game_dir, group_id, '0.pamt')
    if not os.path.exists(pamt_path):
        print(f"  PAMT not found: {pamt_path}")
        return {}

    data = open(pamt_path, 'rb').read()
    info = read_pamt(data)
    idx = build_file_index(info)

    if verbose:
        print(f"\n{'='*70}")
        print(f"Group {group_id}: {len(idx)} files")
        print(f"  HeaderCrc: 0x{info.header_crc:08X}")
        print(f"  PazCount: {info.paz_count}")
        print(f"  Unknown: 0x{info.unknown:08X}")
        for pi in info.paz_infos:
            print(f"  PazInfo: index={pi[0]}, crc=0x{pi[1]:08X}, size={pi[2]}")
        print(f"  DirBlock: offset={info.dir_block_offset}, size={info.dir_block_size}")
        print(f"  FnBlock:  offset={info.fn_block_offset}, size={info.fn_block_size}")
        print(f"  HashEntries: {info.hash_count}")
        print(f"  FileRecords: {info.file_count}")
        print(f"  {'='*70}")

        for path, rec in sorted(idx.items()):
            enc = "ENC" if is_encrypted(rec['flags']) else "   "
            comp_ratio = f"{rec['comp_size']/rec['decomp_size']*100:.0f}%" if rec['decomp_size'] > 0 else "N/A"
            print(f"  {enc} paz[{rec['paz_index']}] @0x{rec['paz_offset']:08X} "
                  f"comp={rec['comp_size']:>10} decomp={rec['decomp_size']:>10} "
                  f"({comp_ratio:>4}) flags=0x{rec['flags']:04X} {path}")

    return idx


def search_all_groups(game_dir, target, verbose=False):
    """Search all PAMTs for a file matching target."""
    groups = get_all_groups(game_dir)
    print(f"Searching {len(groups)} groups for '{target}'...\n")

    all_results = []
    for g in groups:
        pamt_path = os.path.join(game_dir, g, '0.pamt')
        try:
            data = open(pamt_path, 'rb').read()
            info = read_pamt(data)
            results = find_file(info, target)
            if results:
                for path, rec in results:
                    enc = "ENCRYPTED" if is_encrypted(rec['flags']) else "plain"
                    print(f"  FOUND in group {g}: {path}")
                    print(f"    PAZ index: {rec['paz_index']}, Offset: 0x{rec['paz_offset']:08X}")
                    print(f"    Compressed: {rec['comp_size']}, Decompressed: {rec['decomp_size']}")
                    print(f"    Flags: 0x{rec['flags']:04X} ({enc}, enc_type={rec['flags']>>4})")
                    print()
                    all_results.append((g, path, rec))
        except Exception as e:
            if verbose:
                print(f"  Error parsing {g}: {e}")

    if not all_results:
        print(f"  '{target}' NOT FOUND in any group.")
    else:
        print(f"\nTotal: {len(all_results)} match(es) found.")

    return all_results


def scan_all_pabgb(game_dir):
    """Find ALL .pabgb files across all groups."""
    groups = get_all_groups(game_dir)
    print(f"Scanning {len(groups)} groups for all .pabgb files...\n")

    all_pabgb = []
    for g in groups:
        pamt_path = os.path.join(game_dir, g, '0.pamt')
        try:
            data = open(pamt_path, 'rb').read()
            info = read_pamt(data)
            idx = build_file_index(info)
            for path, rec in sorted(idx.items()):
                if path.lower().endswith('.pabgb'):
                    all_pabgb.append((g, path, rec))
        except Exception as e:
            pass

    print(f"{'Group':>6} {'Flags':>6} {'CompSize':>12} {'DecompSize':>12} Path")
    print(f"{'='*6} {'='*6} {'='*12} {'='*12} {'='*50}")
    for g, path, rec in all_pabgb:
        print(f"{g:>6} 0x{rec['flags']:04X} {rec['comp_size']:>12} {rec['decomp_size']:>12} {path}")

    print(f"\nTotal: {len(all_pabgb)} .pabgb files found.")
    return all_pabgb


def main():
    parser = argparse.ArgumentParser(description='PAMT Parser for Crimson Desert archives')
    parser.add_argument('--game-dir', default=GAME_DIR, help='Game installation directory')
    parser.add_argument('--search', type=str, help='Search for a file by name (partial match)')
    parser.add_argument('--group', type=str, help='Parse a specific group')
    parser.add_argument('--dump', type=str, help='Dump all files in a group (verbose)')
    parser.add_argument('--scan-pabgb', action='store_true', help='Find all .pabgb files across all groups')
    parser.add_argument('--scan-all', action='store_true', help='List ALL files across all groups')
    parser.add_argument('--extract', type=str, help='Extract a file (full or partial path)')
    parser.add_argument('--output', type=str, help='Output path for extracted file')
    parser.add_argument('--verify-overlay', action='store_true', help='Parse and display the 0036 overlay PAMT')
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')

    args = parser.parse_args()
    game_dir = args.game_dir

    if not os.path.exists(game_dir):
        print(f"ERROR: Game directory not found: {game_dir}")
        sys.exit(1)

    if args.scan_pabgb:
        scan_all_pabgb(game_dir)
    elif args.scan_all:
        groups = get_all_groups(game_dir)
        total = 0
        for g in groups:
            idx = dump_group(game_dir, g, verbose=True)
            total += len(idx)
        print(f"\nGrand total: {total} files across {len(groups)} groups")
    elif args.dump:
        dump_group(game_dir, args.dump, verbose=True)
    elif args.group:
        dump_group(game_dir, args.group, verbose=True)
    elif args.search:
        search_all_groups(game_dir, args.search, verbose=args.verbose)
    elif args.extract:
        # Find the file first
        results = search_all_groups(game_dir, args.extract, verbose=args.verbose)
        if not results:
            sys.exit(1)

        # Extract the first match
        group_id, path, rec = results[0]
        filename = os.path.basename(path)
        print(f"\nExtracting: {path} from group {group_id}")
        extracted = extract_file(game_dir, group_id, rec, filename)

        output = args.output or filename
        with open(output, 'wb') as f:
            f.write(extracted)
        print(f"\nExtracted {len(extracted)} bytes to: {output}")

        # Show a preview
        print(f"\nFirst 256 bytes (hex):")
        for i in range(0, min(256, len(extracted)), 16):
            hex_part = ' '.join(f'{b:02x}' for b in extracted[i:i+16])
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in extracted[i:i+16])
            print(f"  {i:08x}: {hex_part:<48s} {ascii_part}")

        # Look for readable strings
        print(f"\nSearching for readable strings (min length 6)...")
        strings_found = []
        current = bytearray()
        for i, b in enumerate(extracted):
            if 32 <= b < 127:
                current.append(b)
            else:
                if len(current) >= 6:
                    strings_found.append((i - len(current), current.decode('ascii', errors='replace')))
                current = bytearray()
        if current and len(current) >= 6:
            strings_found.append((len(extracted) - len(current), current.decode('ascii', errors='replace')))

        if strings_found:
            print(f"  Found {len(strings_found)} strings. First 30:")
            for offset, s in strings_found[:30]:
                print(f"    @0x{offset:08X}: {s[:80]}")
        else:
            print("  No readable ASCII strings found (file may be binary/structured data)")
    elif args.verify_overlay:
        print("=== Overlay PAMT (0036) ===")
        pamt_path = os.path.join(game_dir, '0036', '0.pamt')
        if os.path.exists(pamt_path):
            data = open(pamt_path, 'rb').read()
            print(f"Size: {len(data)} bytes")
            print(f"Hex dump:")
            for i in range(0, len(data), 16):
                hex_part = ' '.join(f'{b:02x}' for b in data[i:i+16])
                ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in data[i:i+16])
                print(f"  {i:08x}: {hex_part:<48s} {ascii_part}")
            print()
            info = read_pamt(data)
            idx = build_file_index(info)
            print(f"\nParsed overlay:")
            dump_group(game_dir, '0036', verbose=True)
        else:
            print("  No overlay PAMT exists at 0036/0.pamt")
    else:
        # Default: scan for all .pabgb files
        scan_all_pabgb(game_dir)


if __name__ == '__main__':
    main()
