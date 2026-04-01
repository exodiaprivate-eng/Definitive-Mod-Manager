"""
Apply JSON byte-patch mods to Crimson Desert game files.

Uses CDUMM's proven extraction logic to:
1. Parse all game PAMT indices to find target files
2. Extract and LZ4-decompress files from PAZ archives
3. Apply byte patches from JSON mod files
4. Build a new overlay PAZ/PAMT at 0036/
5. Update meta/0.papgt to reference the overlay

Called from the Rust backend as a subprocess:
    python apply_mods.py '{"game_path":"...","mods_path":"...","backup_dir":"...","active_mods":[...]}'

Output: JSON on stdout with {"success": bool, "applied": [...], "errors": [...], "backup_created": bool}
"""

import sys
import os
import json
import struct
import shutil
from pathlib import Path
from collections import OrderedDict

import lz4.block

# Bob Jenkins hashlittle hash — used for PAMT/PAPGT integrity checksums
INTEGRITY_SEED = 0xC5EDE

def hashlittle(data: bytes, initval: int = 0) -> int:
    length = len(data)
    a = b = c = (0xDEADBEEF + length + initval) & 0xFFFFFFFF
    offset = 0
    while length > 12:
        a = (a + struct.unpack_from("<I", data, offset)[0]) & 0xFFFFFFFF
        b = (b + struct.unpack_from("<I", data, offset + 4)[0]) & 0xFFFFFFFF
        c = (c + struct.unpack_from("<I", data, offset + 8)[0]) & 0xFFFFFFFF
        a = (a - c) & 0xFFFFFFFF; a ^= ((c << 4) | (c >> 28)) & 0xFFFFFFFF; c = (c + b) & 0xFFFFFFFF
        b = (b - a) & 0xFFFFFFFF; b ^= ((a << 6) | (a >> 26)) & 0xFFFFFFFF; a = (a + c) & 0xFFFFFFFF
        c = (c - b) & 0xFFFFFFFF; c ^= ((b << 8) | (b >> 24)) & 0xFFFFFFFF; b = (b + a) & 0xFFFFFFFF
        a = (a - c) & 0xFFFFFFFF; a ^= ((c << 16) | (c >> 16)) & 0xFFFFFFFF; c = (c + b) & 0xFFFFFFFF
        b = (b - a) & 0xFFFFFFFF; b ^= ((a << 19) | (a >> 13)) & 0xFFFFFFFF; a = (a + c) & 0xFFFFFFFF
        c = (c - b) & 0xFFFFFFFF; c ^= ((b << 4) | (b >> 28)) & 0xFFFFFFFF; b = (b + a) & 0xFFFFFFFF
        offset += 12; length -= 12
    remaining = data[offset:]
    if length >= 1: a = (a + remaining[0]) & 0xFFFFFFFF
    if length >= 2: a = (a + (remaining[1] << 8)) & 0xFFFFFFFF
    if length >= 3: a = (a + (remaining[2] << 16)) & 0xFFFFFFFF
    if length >= 4: a = (a + (remaining[3] << 24)) & 0xFFFFFFFF
    if length >= 5: b = (b + remaining[4]) & 0xFFFFFFFF
    if length >= 6: b = (b + (remaining[5] << 8)) & 0xFFFFFFFF
    if length >= 7: b = (b + (remaining[6] << 16)) & 0xFFFFFFFF
    if length >= 8: b = (b + (remaining[7] << 24)) & 0xFFFFFFFF
    if length >= 9: c = (c + remaining[8]) & 0xFFFFFFFF
    if length >= 10: c = (c + (remaining[9] << 8)) & 0xFFFFFFFF
    if length >= 11: c = (c + (remaining[10] << 16)) & 0xFFFFFFFF
    if length >= 12: c = (c + (remaining[11] << 24)) & 0xFFFFFFFF
    if length > 0:
        c ^= b; c = (c - ((b << 14) | (b >> 18))) & 0xFFFFFFFF
        a ^= c; a = (a - ((c << 11) | (c >> 21))) & 0xFFFFFFFF
        b ^= a; b = (b - ((a << 25) | (a >> 7))) & 0xFFFFFFFF
        c ^= b; c = (c - ((b << 16) | (b >> 16))) & 0xFFFFFFFF
        a ^= c; a = (a - ((c << 4) | (c >> 28))) & 0xFFFFFFFF
        b ^= a; b = (b - ((a << 14) | (a >> 18))) & 0xFFFFFFFF
        c ^= b; c = (c - ((b << 24) | (b >> 8))) & 0xFFFFFFFF
    return c


# =============================================================================
# PAMT Parser (from our verified parse_pamt.py)
# =============================================================================

def read_pamt(data):
    """Parse a PAMT file into its components."""
    header_crc = struct.unpack_from('<I', data, 0)[0]
    paz_count = struct.unpack_from('<I', data, 4)[0]
    unknown = struct.unpack_from('<I', data, 8)[0]

    pos = 12
    paz_infos = []
    for _ in range(paz_count):
        idx = struct.unpack_from('<I', data, pos)[0]
        crc = struct.unpack_from('<I', data, pos + 4)[0]
        fsize = struct.unpack_from('<I', data, pos + 8)[0]
        paz_infos.append((idx, crc, fsize))
        pos += 12

    # Directory block
    dir_size = struct.unpack_from('<I', data, pos)[0]
    dir_data = data[pos + 4: pos + 4 + dir_size]
    pos += 4 + dir_size

    # Filename block
    fn_size = struct.unpack_from('<I', data, pos)[0]
    fn_data = data[pos + 4: pos + 4 + fn_size]
    pos += 4 + fn_size

    # Hash table
    hash_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    hash_entries = []
    for _ in range(hash_count):
        folder_hash = struct.unpack_from('<I', data, pos)[0]
        name_offset = struct.unpack_from('<I', data, pos + 4)[0]
        file_start = struct.unpack_from('<I', data, pos + 8)[0]
        file_count = struct.unpack_from('<I', data, pos + 12)[0]
        hash_entries.append((folder_hash, name_offset, file_start, file_count))
        pos += 16

    # File records
    file_count = struct.unpack_from('<I', data, pos)[0]
    pos += 4
    file_records = []
    for _ in range(file_count):
        name_off = struct.unpack_from('<I', data, pos)[0]
        paz_off = struct.unpack_from('<I', data, pos + 4)[0]
        comp_size = struct.unpack_from('<I', data, pos + 8)[0]
        decomp_size = struct.unpack_from('<I', data, pos + 12)[0]
        paz_index = struct.unpack_from('<H', data, pos + 16)[0]
        flags = struct.unpack_from('<H', data, pos + 18)[0]
        file_records.append({
            'name_offset': name_off,
            'paz_offset': paz_off,
            'comp_size': comp_size,
            'decomp_size': decomp_size,
            'paz_index': paz_index,
            'flags': flags,
        })
        pos += 20

    return {
        'header_crc': header_crc,
        'paz_count': paz_count,
        'unknown': unknown,
        'paz_infos': paz_infos,
        'dir_data': dir_data,
        'fn_data': fn_data,
        'hash_entries': hash_entries,
        'file_records': file_records,
    }


def resolve_name(block_data, name_offset):
    """Resolve a name from a linked-list name block."""
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
        seg = block_data[offset + 5: offset + 5 + name_len].decode('utf-8', errors='replace')
        segments.append(seg)
        offset = parent
        guard += 1
    segments.reverse()
    return ''.join(segments)


def build_file_index(pamt_info):
    """Build a dict of full_path -> file_record for all files in this PAMT."""
    index = {}
    dir_data = pamt_info['dir_data']
    fn_data = pamt_info['fn_data']

    dir_names = {}
    for (folder_hash, name_offset, file_start, file_count) in pamt_info['hash_entries']:
        dir_names[folder_hash] = resolve_name(dir_data, name_offset)

    for i, rec in enumerate(pamt_info['file_records']):
        filename = resolve_name(fn_data, rec['name_offset'])
        for (folder_hash, name_offset, file_start, file_count) in pamt_info['hash_entries']:
            if file_start <= i < file_start + file_count:
                dirname = dir_names.get(folder_hash, '')
                full_path = f"{dirname}/{filename}" if dirname else filename
                index[full_path] = rec
                break

    return index


# =============================================================================
# File finder -- searches ALL numbered directories in the game
# =============================================================================

def find_file_in_game(game_path, target_file):
    """
    Search all PAMT indices for a target file.
    Returns (group_id, full_path, record) or None.
    Uses exact match, suffix match, and basename match (like CDUMM's _find_pamt_entry).
    """
    target_lower = target_file.lower().replace("\\", "/")
    target_basename = target_lower.rsplit("/", 1)[-1]

    game_dir = Path(game_path)
    basename_match = None

    for d in sorted(game_dir.iterdir()):
        if not d.is_dir() or not d.name.isdigit() or d.name == '0036':
            continue
        pamt_path = d / "0.pamt"
        if not pamt_path.exists():
            continue
        try:
            data = pamt_path.read_bytes()
            pamt_info = read_pamt(data)
            file_idx = build_file_index(pamt_info)
            for path, rec in file_idx.items():
                ep = path.lower().replace("\\", "/")
                # Exact match
                if ep == target_lower:
                    return (d.name, path, rec)
                # PAMT path is suffix of target
                if target_lower.endswith("/" + ep) or target_lower.endswith(ep):
                    return (d.name, path, rec)
                # target is suffix of PAMT path
                if ep.endswith("/" + target_lower):
                    return (d.name, path, rec)
                # Basename match (last resort)
                if ep.rsplit("/", 1)[-1] == target_basename:
                    if basename_match is None:
                        basename_match = (d.name, path, rec)
                    else:
                        basename_match = False  # ambiguous
        except Exception:
            continue

    if basename_match and basename_match is not False:
        return basename_match
    return None


# =============================================================================
# File extraction from PAZ archives (CDUMM approach)
# =============================================================================

def extract_from_paz(game_path, group_id, record, filename):
    """
    Extract a file from the base game PAZ archive.
    Handles LZ4 decompression and ChaCha20 decryption.
    Returns decompressed plaintext bytes.
    """
    paz_path = os.path.join(game_path, group_id, "0.paz")
    if not os.path.exists(paz_path):
        raise FileNotFoundError(f"PAZ not found: {paz_path}")

    comp_size = record['comp_size']
    decomp_size = record['decomp_size']
    paz_offset = record['paz_offset']
    flags = record['flags']

    with open(paz_path, 'rb') as f:
        f.seek(paz_offset)
        raw = f.read(comp_size)

    if len(raw) != comp_size:
        raise ValueError(f"Short read: got {len(raw)} bytes, expected {comp_size}")

    # Decrypt if needed (flags >> 4 != 0)
    enc_type = flags >> 4
    if enc_type != 0:
        # Import decrypt from parse_pamt.py's built-in chacha20
        raw = _decrypt_chacha20(raw, filename)

    # Decompress if sizes differ (LZ4)
    if comp_size != decomp_size:
        return lz4.block.decompress(raw, uncompressed_size=decomp_size)
    else:
        return raw


def _decrypt_chacha20(data, filename):
    """ChaCha20 decrypt using filename-derived key (from parse_pamt.py)."""
    HASH_INITVAL = 810718
    IV_XOR = 0x60616263
    XOR_DELTAS = [0, 168430090, 202116108, 101058054, 235802126, 168430090, 101058054, 33686018]

    def u32(x):
        return x & 0xFFFFFFFF

    def rotl(v, n):
        v &= 0xFFFFFFFF
        return ((v << n) | (v >> (32 - n))) & 0xFFFFFFFF

    def _hashlittle_for_key(data_bytes, initval):
        """Jenkins hashlittle for key derivation."""
        length = len(data_bytes)
        a = b = c = u32(0xDEADBEEF + length + initval)
        pos = 0
        remaining = length
        while remaining > 12:
            a = u32(a + struct.unpack_from('<I', data_bytes, pos)[0])
            b = u32(b + struct.unpack_from('<I', data_bytes, pos + 4)[0])
            c = u32(c + struct.unpack_from('<I', data_bytes, pos + 8)[0])
            a = u32(a - c); a ^= rotl(c, 4); c = u32(c + b)
            b = u32(b - a); b ^= rotl(a, 6); a = u32(a + c)
            c = u32(c - b); c ^= rotl(b, 8); b = u32(b + a)
            a = u32(a - c); a ^= rotl(c, 16); c = u32(c + b)
            b = u32(b - a); b ^= rotl(a, 19); a = u32(a + c)
            c = u32(c - b); c ^= rotl(b, 4); b = u32(b + a)
            pos += 12
            remaining -= 12
        if remaining >= 12: c = u32(c + (data_bytes[pos + 11] << 24))
        if remaining >= 11: c = u32(c + (data_bytes[pos + 10] << 16))
        if remaining >= 10: c = u32(c + (data_bytes[pos + 9] << 8))
        if remaining >= 9:  c = u32(c + data_bytes[pos + 8])
        if remaining >= 8:  b = u32(b + (data_bytes[pos + 7] << 24))
        if remaining >= 7:  b = u32(b + (data_bytes[pos + 6] << 16))
        if remaining >= 6:  b = u32(b + (data_bytes[pos + 5] << 8))
        if remaining >= 5:  b = u32(b + data_bytes[pos + 4])
        if remaining >= 4:  a = u32(a + (data_bytes[pos + 3] << 24))
        if remaining >= 3:  a = u32(a + (data_bytes[pos + 2] << 16))
        if remaining >= 2:  a = u32(a + (data_bytes[pos + 1] << 8))
        if remaining >= 1:  a = u32(a + data_bytes[pos])
        n6 = u32(u32(b ^ c) - rotl(b, 14))
        n7 = u32(u32(a ^ n6) - rotl(n6, 11))
        rotr7 = lambda v: ((v & 0xFFFFFFFF) >> 7 | (v << 25)) & 0xFFFFFFFF
        n8 = u32(u32(n7 ^ b) - rotr7(n7))
        n9 = u32(u32(n8 ^ n6) - rotl(n8, 16))
        n10 = rotl(n9, 4)
        n11 = u32(u32(n7 ^ n9) - n10)
        n12 = u32(u32(n11 ^ n8) - rotl(n11, 14))
        rotr8 = lambda v: ((v & 0xFFFFFFFF) >> 8 | (v << 24)) & 0xFFFFFFFF
        return u32(u32(n12 ^ n9) - rotr8(n12))

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

    basename = os.path.basename(filename).lower()
    h = _hashlittle_for_key(basename.encode('utf-8'), HASH_INITVAL)
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


# =============================================================================
# Build overlay PAMT (from mount_multi.py's proven approach)
# =============================================================================

def build_multi_pamt(files, paz_data_len):
    """
    Build a PAMT for the overlay directory with multiple files.
    Uses the same structure as mount_multi.py which was verified working.

    files: list of dicts with keys: dir_path, filename, paz_offset,
           comp_size, decomp_size, flags
    paz_data_len: total length of the PAZ file
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
    grouped = OrderedDict()
    for f in files:
        if f['dir_path'] not in grouped:
            grouped[f['dir_path']] = []
        grouped[f['dir_path']].append(f)

    file_idx = 0
    for dir_path, dir_files in sorted(grouped.items()):
        folder_hash = hashlittle(dir_path.encode('utf-8'), INTEGRITY_SEED)
        dir_name_offset = dir_offsets[dir_path]
        start_index = file_idx

        for f in dir_files:
            fn_offset = len(fn_block)
            fn_bytes = f['filename'].encode('utf-8')
            fn_block += struct.pack('<I', 0xFFFFFFFF)
            fn_block.append(len(fn_bytes))
            fn_block += fn_bytes

            file_records_data.append(struct.pack('<IIIIHH',
                fn_offset,
                f['paz_offset'],
                f['comp_size'],
                f['decomp_size'],
                0,  # paz_index always 0 for overlay
                f.get('flags', 0x0002)
            ))
            file_idx += 1

        hash_entries_data.append(struct.pack('<IIII',
            folder_hash,
            dir_name_offset,
            start_index,
            len(dir_files)
        ))

    # ---- Assemble PAMT ----
    inner = bytearray()
    inner += struct.pack('<I', 1)            # PazCount = 1
    inner += struct.pack('<I', 0x610E0232)   # Magic
    inner += struct.pack('<I', 0)            # PazInfo: Index = 0
    inner += struct.pack('<I', 0)            # PazInfo: Crc = 0 (filled later)
    inner += struct.pack('<I', paz_data_len) # PazInfo: FileSize

    # Dir block
    inner += struct.pack('<I', len(dir_block))
    inner += bytes(dir_block)

    # Filename block
    inner += struct.pack('<I', len(fn_block))
    inner += bytes(fn_block)

    # Hash entries
    inner += struct.pack('<I', len(hash_entries_data))
    for h in hash_entries_data:
        inner += h

    # File records
    inner += struct.pack('<I', len(file_records_data))
    for r in file_records_data:
        inner += r

    # Compute header CRC
    header_crc = hashlittle(bytes(inner[8:]), INTEGRITY_SEED)

    # Final PAMT
    pamt = struct.pack('<I', header_crc) + bytes(inner)
    return bytearray(pamt)


def update_pamt_paz_crc(pamt, paz_data):
    """
    Update the PAMT PazCrc from the PAZ data, then recompute HeaderCrc.
    1. paz_crc = hashlittle(paz_data, INTEGRITY_SEED)
    2. Write paz_crc at pamt[16:20]
    3. header_crc = hashlittle(pamt[12:], INTEGRITY_SEED)
    4. Write header_crc at pamt[0:4]
    """
    paz_crc = hashlittle(paz_data, INTEGRITY_SEED)
    struct.pack_into('<I', pamt, 16, paz_crc)
    header_crc = hashlittle(bytes(pamt[12:]), INTEGRITY_SEED)
    struct.pack_into('<I', pamt, 0, header_crc)


# =============================================================================
# Build PAPGT with overlay entry
# =============================================================================

def build_papgt_with_overlay(clean_papgt, pamt_header_crc):
    """
    Build a PAPGT that includes the 0036 overlay entry.
    Uses the same approach as mount_multi.py which was verified working.
    """
    if len(clean_papgt) < 12:
        raise ValueError("Clean PAPGT too small")

    entry_count = clean_papgt[8]

    # Build new PAPGT
    new_papgt = bytearray()
    new_papgt.extend(clean_papgt[:4])       # PlatformMagic
    new_papgt.extend(b"\x00\x00\x00\x00")  # Hash placeholder
    new_papgt.append(entry_count + 1)       # New entry count
    new_papgt.extend(clean_papgt[9:12])     # LangType + Zero

    # First entry: 0036 overlay
    new_papgt.append(0)                                  # IsOptional = 0
    new_papgt.extend(struct.pack("<H", 0x3FFF))          # LangType = 0x3FFF
    new_papgt.append(0)                                  # Zero
    new_papgt.extend(struct.pack("<I", 0))               # NameOffset = 0 (start of names block)
    new_papgt.extend(struct.pack("<I", pamt_header_crc)) # PamtCrc

    # Copy existing entries with shifted name offsets (+5 for "0036\0")
    for i in range(entry_count):
        off = 12 + i * 12
        new_papgt.extend(clean_papgt[off:off + 4])  # IsOptional + LangType + Zero
        name_off = struct.unpack_from("<I", clean_papgt, off + 4)[0]
        new_papgt.extend(struct.pack("<I", name_off + 5))  # Shifted name offset
        new_papgt.extend(clean_papgt[off + 8:off + 12])    # PamtCrc

    # Names block: find where names start in the clean PAPGT
    entries_end = 12 + entry_count * 12
    names_block_len = struct.unpack_from('<I', clean_papgt, entries_end)[0]
    names_start = entries_end + 4
    old_names = clean_papgt[names_start:names_start + names_block_len]

    # Prepend "0036\0" to names
    new_names = b"0036\x00" + bytes(old_names)
    new_papgt.extend(struct.pack("<I", len(new_names)))
    new_papgt.extend(new_names)

    # Compute hash = hashlittle(papgt[12:], INTEGRITY_SEED)
    papgt_hash = hashlittle(bytes(new_papgt[12:]), INTEGRITY_SEED)
    struct.pack_into("<I", new_papgt, 4, papgt_hash)

    return bytes(new_papgt)


# =============================================================================
# Parse a mod JSON file
# =============================================================================

def parse_mod_file(path):
    """Parse a mod JSON file and return its data."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_mod_title(mod_data):
    """Get the display title from a mod."""
    info = mod_data.get('modinfo', {}) or {}
    return (
        info.get('title')
        or mod_data.get('title')
        or mod_data.get('name')
        or 'Unknown'
    )


# =============================================================================
# Main apply logic
# =============================================================================

def main():
    args = json.loads(sys.argv[1])
    game_path = args['game_path']
    mods_path = args['mods_path']
    backup_dir = args['backup_dir']
    active_mods = args['active_mods']  # list of {fileName, disabledIndices}

    result = {
        'success': True,
        'applied': [],
        'errors': [],
        'backup_created': False,
    }

    backup_path = Path(backup_dir)
    backup_path.mkdir(parents=True, exist_ok=True)

    # Collect all patches grouped by game file
    # file_patches: game_file -> [(mod_title, [changes])]
    file_patches = {}

    for active_mod in active_mods:
        file_name = active_mod['fileName']
        disabled_indices = active_mod.get('disabledIndices', [])

        mod_path = Path(mods_path) / file_name
        if not mod_path.exists():
            result['errors'].append(f"{file_name}: File not found")
            result['success'] = False
            continue

        try:
            mod_data = parse_mod_file(mod_path)
        except Exception as e:
            result['errors'].append(f"{file_name}: Failed to parse: {e}")
            result['success'] = False
            continue

        title = get_mod_title(mod_data)

        for patch in mod_data.get('patches', []):
            game_file = patch.get('game_file', '')
            changes = [
                c for i, c in enumerate(patch.get('changes', []))
                if i not in disabled_indices
            ]
            if changes:
                if game_file not in file_patches:
                    file_patches[game_file] = []
                file_patches[game_file].append((title, changes))

    if not file_patches:
        if not result['errors']:
            result['errors'].append("No patches to apply")
            result['success'] = False
        print(json.dumps(result))
        return

    # Separate PAZ-archived files from regular files
    pabgb_patches = {}  # game_file -> [(title, changes)]
    regular_patches = {}

    for game_file, mod_patches in file_patches.items():
        is_pabgb = game_file.startswith("gamedata/") or game_file.endswith(".pabgb")
        if is_pabgb:
            pabgb_patches[game_file] = mod_patches
        else:
            regular_patches[game_file] = mod_patches

    # === MULTI-FILE PAZ OVERLAY PIPELINE ===
    if pabgb_patches:
        overlay_dir = Path(game_path) / "0036"
        overlay_paz = overlay_dir / "0.paz"
        overlay_pamt = overlay_dir / "0.pamt"
        papgt_path = Path(game_path) / "meta" / "0.papgt"

        overlay_dir.mkdir(parents=True, exist_ok=True)

        # Backup PAPGT (only first time)
        papgt_backup = backup_path / "papgt_clean.bin"
        if not papgt_backup.exists() and papgt_path.exists():
            shutil.copy2(papgt_path, papgt_backup)
            result['backup_created'] = True

        # Process each game file: find, extract, patch, compress
        overlay_files = []
        paz_data = bytearray()
        had_error = False

        for game_file, mod_patches in sorted(pabgb_patches.items()):
            bare_filename = game_file.rsplit('/', 1)[-1] if '/' in game_file else game_file
            # All pabgb files live at gamedata/binary__/client/bin/ regardless of
            # what the mod JSON says (mods use shortened paths like "gamedata/storeinfo.pabgb")
            dir_path = "gamedata/binary__/client/bin"

            clean_name = bare_filename.replace(".pabgb", "_clean.bin")
            clean_backup = backup_path / clean_name

            # Get clean decompressed data
            try:
                if clean_backup.exists():
                    flat_data = bytearray(clean_backup.read_bytes())
                    log(f"Using cached clean {bare_filename}: {len(flat_data)} bytes")
                else:
                    # Find the file in the base game archives
                    found = find_file_in_game(game_path, game_file)
                    if found is None:
                        raise FileNotFoundError(
                            f"'{game_file}' not found in any PAMT index"
                        )
                    group_id, full_path, record = found
                    log(f"Found {game_file} in group {group_id}: "
                        f"comp={record['comp_size']}, decomp={record['decomp_size']}, "
                        f"flags=0x{record['flags']:04X}")

                    extracted = extract_from_paz(game_path, group_id, record, bare_filename)
                    flat_data = bytearray(extracted)
                    log(f"Extracted clean {bare_filename}: {len(flat_data)} bytes")

                    # Cache the clean data
                    clean_backup.write_bytes(flat_data)
                    result['backup_created'] = True
            except Exception as e:
                result['errors'].append(f"Failed to extract {bare_filename}: {e}")
                result['success'] = False
                had_error = True
                continue

            # Apply byte patches
            for mod_title, changes in mod_patches:
                for change in changes:
                    offset = change['offset']
                    patched_hex = change['patched']
                    patched_bytes = bytes.fromhex(patched_hex)

                    if offset + len(patched_bytes) > len(flat_data):
                        result['errors'].append(
                            f"{mod_title}: offset {offset} exceeds "
                            f"{bare_filename} size ({len(flat_data)})"
                        )
                        continue

                    flat_data[offset:offset + len(patched_bytes)] = patched_bytes

                if mod_title not in result['applied']:
                    result['applied'].append(mod_title)

            # LZ4 compress
            compressed = lz4.block.compress(bytes(flat_data), store_size=False)

            # Record offset before padding
            paz_offset = len(paz_data)
            comp_size = len(compressed)
            decomp_size = len(flat_data)

            # Append to PAZ with 16-byte alignment
            paz_data.extend(compressed)
            padded_size = (len(paz_data) + 15) & ~15
            paz_data.extend(b'\x00' * (padded_size - len(paz_data)))

            overlay_files.append({
                'dir_path': dir_path,
                'filename': bare_filename,
                'paz_offset': paz_offset,
                'comp_size': comp_size,
                'decomp_size': decomp_size,
                'flags': 0x0002,  # LZ4 compressed
            })

            log(f"Compressed {bare_filename}: {decomp_size} -> {comp_size} bytes")

        if had_error and not overlay_files:
            pass  # All files failed, skip overlay writing
        elif overlay_files:
            # Build PAMT
            paz_total_len = len(paz_data)
            pamt = build_multi_pamt(overlay_files, paz_total_len)

            # Write PAZ
            overlay_paz.write_bytes(paz_data)

            # Update PAMT PazCrc from the PAZ data
            update_pamt_paz_crc(pamt, bytes(paz_data))

            # Write PAMT
            overlay_pamt.write_bytes(pamt)

            log(f"Wrote overlay: {len(overlay_files)} files, "
                f"PAZ={len(paz_data)} bytes, PAMT={len(pamt)} bytes")

            # Build PAPGT with 0036 entry
            pamt_header_crc = struct.unpack_from('<I', pamt, 0)[0]

            clean_papgt_data = None
            if papgt_backup.exists():
                clean_papgt_data = papgt_backup.read_bytes()
            elif papgt_path.exists():
                clean_papgt_data = papgt_path.read_bytes()

            if clean_papgt_data:
                try:
                    new_papgt = build_papgt_with_overlay(clean_papgt_data, pamt_header_crc)
                    papgt_path.write_bytes(new_papgt)
                    log(f"Updated PAPGT: {len(new_papgt)} bytes")
                except Exception as e:
                    result['errors'].append(f"Failed to build PAPGT: {e}")
                    result['success'] = False
            else:
                result['errors'].append("No PAPGT found (neither backup nor current)")
                result['success'] = False

    # === REGULAR FILE PATCHING (non-PAZ) ===
    for game_file, mod_patches in regular_patches.items():
        file_path = Path(game_path) / game_file
        if not file_path.exists():
            result['errors'].append(f"Game file not found: {game_file}")
            result['success'] = False
            continue

        # Backup original
        backup_name = game_file.replace('/', '_').replace('\\', '_') + '.original'
        backup_file = backup_path / backup_name
        if not backup_file.exists():
            try:
                shutil.copy2(file_path, backup_file)
                result['backup_created'] = True
            except Exception as e:
                result['errors'].append(f"Backup failed for {game_file}: {e}")
                result['success'] = False
                continue

        data = bytearray(file_path.read_bytes())

        for mod_title, changes in mod_patches:
            for change in changes:
                offset = change['offset']
                patched_bytes = bytes.fromhex(change['patched'])
                if offset + len(patched_bytes) > len(data):
                    continue
                data[offset:offset + len(patched_bytes)] = patched_bytes

            if mod_title not in result['applied']:
                result['applied'].append(mod_title)

        file_path.write_bytes(data)

    print(json.dumps(result))


# Log to stderr so it doesn't pollute stdout JSON
def log(msg):
    print(msg, file=sys.stderr)


if __name__ == '__main__':
    main()
