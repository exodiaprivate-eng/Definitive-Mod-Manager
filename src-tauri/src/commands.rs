use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::fs;
use std::io::Read as IoRead;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModChange {
    pub offset: u64,
    pub label: String,
    pub original: String,
    pub patched: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModPatch {
    pub game_file: String,
    pub changes: Vec<ModChange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModInfo {
    pub title: Option<String>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModFile {
    #[serde(flatten)]
    pub info: ModInfo,
    pub modinfo: Option<ModInfo>,
    pub patches: Vec<ModPatch>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActiveMod {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "disabledIndices")]
    pub disabled_indices: Vec<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(rename = "gamePath")]
    pub game_path: String,
    #[serde(rename = "modsPath")]
    pub mods_path: String,
    #[serde(rename = "activeMods")]
    pub active_mods: Vec<ActiveMod>,
    #[serde(rename = "activeAsiMods")]
    pub active_asi_mods: Vec<String>,
    #[serde(rename = "activeTextures", default)]
    pub active_textures: Vec<String>,
    #[serde(rename = "activeBrowserMods", default)]
    pub active_browser_mods: Vec<String>,
    #[serde(rename = "activeLangMod", default, skip_serializing_if = "Option::is_none")]
    pub active_lang_mod: Option<String>,
    #[serde(rename = "selectedLanguage", default = "default_language")]
    pub selected_language: String,
    #[serde(rename = "nexusApiKey", default)]
    pub nexus_api_key: String,
}

fn default_language() -> String {
    "english".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModEntry {
    pub file_name: String,
    pub title: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub enabled: bool,
    pub patch_count: usize,
    pub game_files: Vec<String>,
    pub has_conflicts: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictInfo {
    pub offset: u64,
    pub game_file: String,
    pub mods: Vec<String>,
    pub labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApplyResult {
    pub success: bool,
    pub applied: Vec<String>,
    pub errors: Vec<String>,
    pub backup_created: bool,
}

fn parse_mod_file(path: &Path) -> Result<ModFile, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn get_mod_display_info(m: &ModFile) -> (String, String, String, String) {
    let info = m.modinfo.as_ref();
    let title = info.and_then(|i| i.title.clone())
        .or_else(|| m.info.title.clone())
        .or_else(|| m.info.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    let version = info.and_then(|i| i.version.clone())
        .or_else(|| m.info.version.clone())
        .unwrap_or_else(|| "?".to_string());
    let author = info.and_then(|i| i.author.clone())
        .or_else(|| m.info.author.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    let description = info.and_then(|i| i.description.clone())
        .or_else(|| m.info.description.clone())
        .unwrap_or_default();
    (title, version, author, description)
}

#[tauri::command]
pub fn load_config(config_path: String) -> Result<AppConfig, String> {
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
pub fn save_config(config_path: String, config: AppConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
pub fn scan_mods(mods_path: String, active_mods: Vec<ActiveMod>) -> Result<Vec<ModEntry>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    let active_names: Vec<&str> = active_mods.iter().map(|m| m.file_name.as_str()).collect();
    let mut entries = Vec::new();

    let read_dir = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let file_name = path.file_name().unwrap().to_string_lossy().to_string();

        match parse_mod_file(&path) {
            Ok(mod_file) => {
                let (title, version, author, description) = get_mod_display_info(&mod_file);
                let patch_count: usize = mod_file.patches.iter()
                    .map(|p| p.changes.len())
                    .sum();
                let game_files: Vec<String> = mod_file.patches.iter()
                    .map(|p| p.game_file.clone())
                    .collect();
                let enabled = active_names.contains(&file_name.as_str());

                entries.push(ModEntry {
                    file_name,
                    title,
                    version,
                    author,
                    description,
                    enabled,
                    patch_count,
                    game_files,
                    has_conflicts: false,
                });
            }
            Err(e) => {
                log::warn!("Skipping {}: {}", file_name, e);
            }
        }
    }

    entries.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(entries)
}

#[tauri::command]
pub fn get_mod_details(mods_path: String, file_name: String) -> Result<ModFile, String> {
    let path = Path::new(&mods_path).join(&file_name);
    parse_mod_file(&path)
}

#[tauri::command]
pub fn check_conflicts(mods_path: String, active_mods: Vec<String>, browser_mod_folders: Option<Vec<String>>, game_path: Option<String>) -> Result<Vec<ConflictInfo>, String> {
    let mods_dir = Path::new(&mods_path);
    let mut offset_map: HashMap<(String, u64), Vec<(String, String)>> = HashMap::new();

    // JSON byte-patch mod conflicts (offset-level)
    for file_name in &active_mods {
        let path = mods_dir.join(file_name);
        if let Ok(mod_file) = parse_mod_file(&path) {
            let (title, _, _, _) = get_mod_display_info(&mod_file);
            for patch in &mod_file.patches {
                for change in &patch.changes {
                    let key = (patch.game_file.clone(), change.offset);
                    offset_map.entry(key)
                        .or_default()
                        .push((title.clone(), change.label.clone()));
                }
            }
        }
    }

    let mut conflicts: Vec<ConflictInfo> = offset_map.into_iter()
        .filter(|(_, mods)| mods.len() > 1)
        .map(|((game_file, offset), mods)| {
            ConflictInfo {
                offset,
                game_file,
                mods: mods.iter().map(|(name, _)| name.clone()).collect(),
                labels: mods.iter().map(|(_, label)| label.clone()).collect(),
            }
        })
        .collect();

    // File replacement mod conflicts (file-level)
    if let Some(ref folders) = browser_mod_folders {
        // file_path → list of mod titles that touch it
        let mut file_owners: HashMap<String, Vec<String>> = HashMap::new();

        fn collect_all_paths(dir: &Path, base: &Path, results: &mut Vec<String>) {
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.filter_map(|e| e.ok()) {
                    let p = e.path();
                    if p.is_dir() { collect_all_paths(&p, base, results); }
                    else if let Ok(rel) = p.strip_prefix(base) {
                        results.push(rel.to_string_lossy().replace('\\', "/"));
                    }
                }
            }
        }

        fn get_mod_title(mod_dir: &Path, folder_name: &str) -> String {
            for name in &["manifest.json", "mod.json"] {
                let p = mod_dir.join(name);
                if let Ok(data) = fs::read_to_string(&p) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                        let info = v.get("modinfo").unwrap_or(&v);
                        if let Some(t) = info.get("title").and_then(|t| t.as_str()) {
                            return t.to_string();
                        }
                        if let Some(t) = v.get("title").and_then(|t| t.as_str()) {
                            return t.to_string();
                        }
                    }
                }
            }
            folder_name.to_string()
        }

        for folder_name in folders {
            let mod_dir = mods_dir.join(folder_name);
            if !mod_dir.exists() { continue; }
            let title = get_mod_title(&mod_dir, folder_name);

            // Try manifest/mod.json files/ subdir first
            let mut found_files = false;
            for manifest_name in &["manifest.json", "mod.json"] {
                let manifest_path = mod_dir.join(manifest_name);
                if let Ok(data) = fs::read_to_string(&manifest_path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                        let files_dir_name = v.get("files_dir").and_then(|f| f.as_str()).unwrap_or("files");
                        let files_dir = mod_dir.join(files_dir_name);
                        if files_dir.exists() {
                            let mut paths = Vec::new();
                            collect_all_paths(&files_dir, &files_dir, &mut paths);
                            for p in paths {
                                file_owners.entry(p.to_lowercase()).or_default().push(title.clone());
                            }
                            found_files = true;
                            break;
                        }
                    }
                }
            }

            // Try loose folder layout
            if !found_files {
                if let Ok(rd) = fs::read_dir(&mod_dir) {
                    for sub in rd.filter_map(|e| e.ok()) {
                        let sub_name = sub.file_name().to_string_lossy().to_string();
                        if sub.path().is_dir() && is_paz_group_dir(&sub_name) {
                            let mut paths = Vec::new();
                            collect_all_paths(&sub.path(), &mod_dir, &mut paths);
                            for p in paths {
                                file_owners.entry(p.to_lowercase()).or_default().push(title.clone());
                            }
                        }
                    }
                }
            }
        }

        // Detect file-level conflicts (two mods replacing same file)
        for (file_path, owners) in &file_owners {
            if owners.len() > 1 {
                conflicts.push(ConflictInfo {
                    offset: 0,
                    game_file: file_path.clone(),
                    mods: owners.clone(),
                    labels: owners.iter().map(|o| format!("{} replaces this file", o)).collect(),
                });
            }
        }

        // Cross-format conflicts: JSON mod patches a file that a file replacement mod also provides
        // Collect filenames that JSON mods target
        let mut json_targets: HashMap<String, Vec<String>> = HashMap::new();
        for file_name in &active_mods {
            let path = mods_dir.join(file_name);
            if let Ok(mod_file) = parse_mod_file(&path) {
                let (title, _, _, _) = get_mod_display_info(&mod_file);
                for patch in &mod_file.patches {
                    let bare = patch.game_file.rsplit('/').next().unwrap_or(&patch.game_file).to_lowercase();
                    json_targets.entry(bare).or_default().push(title.clone());
                }
            }
        }

        // Check if any file replacement mod provides a file that JSON mods also patch
        for (file_path, replacers) in &file_owners {
            let bare = file_path.rsplit('/').next().unwrap_or(file_path).to_lowercase();
            if let Some(json_mods) = json_targets.get(&bare) {
                // This is a cross-format overlap — not necessarily a conflict since we merge them,
                // but worth informing the user
                let mut all_mods = json_mods.clone();
                all_mods.extend(replacers.clone());
                all_mods.sort();
                all_mods.dedup();
                if all_mods.len() > 1 {
                    conflicts.push(ConflictInfo {
                        offset: 0,
                        game_file: bare.clone(),
                        mods: all_mods.clone(),
                        labels: all_mods.iter().map(|m| {
                            if json_mods.contains(m) && replacers.contains(m) {
                                format!("{} patches + replaces this file", m)
                            } else if json_mods.contains(m) {
                                format!("{} patches bytes in this file", m)
                            } else {
                                format!("{} replaces this file (used as base for patches)", m)
                            }
                        }).collect(),
                    });
                }
            }
        }
    }

    // ASI/DLL mod conflict detection
    if let Some(ref gp) = game_path {
        let bin64 = Path::new(gp).join("bin64");
        if bin64.exists() {
            // Collect active ASI/DLL mods and their INI files
            let mut asi_files: Vec<(String, Vec<String>)> = Vec::new(); // (plugin_name, [companion_files])
            if let Ok(entries) = fs::read_dir(&bin64) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let lower = name.to_lowercase();
                    if lower.ends_with(".asi") {
                        let stem = name[..name.len() - 4].to_string();
                        let mut companions = vec![name.clone()];
                        // Check for INI
                        let ini = format!("{}.ini", stem);
                        if bin64.join(&ini).exists() {
                            companions.push(ini);
                        }
                        asi_files.push((stem, companions));
                    }
                }
            }

            // Check if any ASI mods modify the same game DLLs by checking known hook targets
            // Also detect if multiple ASI mods ship the same companion DLL
            let mut dll_owners: HashMap<String, Vec<String>> = HashMap::new();
            if let Ok(entries) = fs::read_dir(&bin64) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let lower = name.to_lowercase();
                    // Skip the loader itself and the game exe
                    if ASI_LOADER_NAMES.contains(&lower.as_str()) || lower.ends_with(".exe") {
                        continue;
                    }
                    if lower.ends_with(".dll") && !lower.ends_with(".asi") {
                        // Check if multiple ASI mods reference this DLL
                        for (plugin_name, companions) in &asi_files {
                            if companions.iter().any(|c| c.to_lowercase() == lower) {
                                dll_owners.entry(lower.clone()).or_default().push(plugin_name.clone());
                            }
                        }
                    }
                }
            }

            // Flag shared DLL conflicts
            for (dll, owners) in &dll_owners {
                if owners.len() > 1 {
                    conflicts.push(ConflictInfo {
                        offset: 0,
                        game_file: format!("bin64/{}", dll),
                        mods: owners.clone(),
                        labels: owners.iter().map(|o| format!("ASI plugin '{}' uses this DLL", o)).collect(),
                    });
                }
            }
        }
    }

    Ok(conflicts)
}

#[tauri::command]
pub fn validate_game_path(game_path: String) -> Result<bool, String> {
    let path = Path::new(&game_path);
    let exe = path.join("bin64").join("CrimsonDesert.exe");
    Ok(path.exists() && exe.exists())
}

#[tauri::command]
pub fn create_backup(game_path: String, game_file: String, backup_dir: String) -> Result<String, String> {
    let source = Path::new(&game_path).join(&game_file);
    let backup_path = Path::new(&backup_dir);

    if !backup_path.exists() {
        fs::create_dir_all(backup_path)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    let backup_name = game_file.replace('/', "_").replace('\\', "_") + ".original";
    let dest = backup_path.join(&backup_name);

    if !dest.exists() {
        fs::copy(&source, &dest)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_backup(game_path: String, game_file: String, backup_dir: String) -> Result<(), String> {
    let backup_name = game_file.replace('/', "_").replace('\\', "_") + ".original";
    let backup = Path::new(&backup_dir).join(&backup_name);
    let target = Path::new(&game_path).join(&game_file);

    if !backup.exists() {
        return Err(format!("No backup found for {}", game_file));
    }

    fs::copy(&backup, &target)
        .map_err(|e| format!("Failed to restore backup: {}", e))?;

    Ok(())
}

// =============================================================================
// hashlittle — Bob Jenkins hashlittle hash for PAPGT and PAMT checksums
// =============================================================================

const INTEGRITY_SEED: u32 = 0xC5EDE; // 810718

fn hashlittle(data: &[u8], initval: u32) -> u32 {
    let length = data.len();
    if length == 0 {
        return 0;
    }

    let init = 0xDEADBEEFu32.wrapping_add(length as u32).wrapping_add(initval);
    let mut a = init;
    let mut b = init;
    let mut c = init;

    let mut offset = 0;
    let mut remaining = length;

    while remaining > 12 {
        a = a.wrapping_add(u32::from_le_bytes(data[offset..offset+4].try_into().unwrap()));
        b = b.wrapping_add(u32::from_le_bytes(data[offset+4..offset+8].try_into().unwrap()));
        c = c.wrapping_add(u32::from_le_bytes(data[offset+8..offset+12].try_into().unwrap()));

        a = a.wrapping_sub(c); a ^= c.rotate_left(4);  c = c.wrapping_add(b);
        b = b.wrapping_sub(a); b ^= a.rotate_left(6);  a = a.wrapping_add(c);
        c = c.wrapping_sub(b); c ^= b.rotate_left(8);  b = b.wrapping_add(a);
        a = a.wrapping_sub(c); a ^= c.rotate_left(16); c = c.wrapping_add(b);
        b = b.wrapping_sub(a); b ^= a.rotate_left(19); a = a.wrapping_add(c);
        c = c.wrapping_sub(b); c ^= b.rotate_left(4);  b = b.wrapping_add(a);

        offset += 12;
        remaining -= 12;
    }

    // Handle remaining bytes (byte-by-byte, little-endian placement)
    let tail = &data[offset..];
    if remaining >= 1  { a = a.wrapping_add(tail[0] as u32); }
    if remaining >= 2  { a = a.wrapping_add((tail[1] as u32) << 8); }
    if remaining >= 3  { a = a.wrapping_add((tail[2] as u32) << 16); }
    if remaining >= 4  { a = a.wrapping_add((tail[3] as u32) << 24); }
    if remaining >= 5  { b = b.wrapping_add(tail[4] as u32); }
    if remaining >= 6  { b = b.wrapping_add((tail[5] as u32) << 8); }
    if remaining >= 7  { b = b.wrapping_add((tail[6] as u32) << 16); }
    if remaining >= 8  { b = b.wrapping_add((tail[7] as u32) << 24); }
    if remaining >= 9  { c = c.wrapping_add(tail[8] as u32); }
    if remaining >= 10 { c = c.wrapping_add((tail[9] as u32) << 8); }
    if remaining >= 11 { c = c.wrapping_add((tail[10] as u32) << 16); }
    if remaining >= 12 { c = c.wrapping_add((tail[11] as u32) << 24); }

    if remaining > 0 {
        // Final mixing
        c ^= b; c = c.wrapping_sub(b.rotate_left(14));
        a ^= c; a = a.wrapping_sub(c.rotate_left(11));
        b ^= a; b = b.wrapping_sub(a.rotate_left(25));
        c ^= b; c = c.wrapping_sub(b.rotate_left(16));
        a ^= c; a = a.wrapping_sub(c.rotate_left(4));
        b ^= a; b = b.wrapping_sub(a.rotate_left(14));
        c ^= b; c = c.wrapping_sub(b.rotate_left(24));
    }

    c
}

fn compute_pamt_hash(pamt_data: &[u8]) -> u32 {
    hashlittle(&pamt_data[12..], INTEGRITY_SEED)
}

fn compute_papgt_hash(papgt_data: &[u8]) -> u32 {
    hashlittle(&papgt_data[12..], INTEGRITY_SEED)
}

/// Update PAMT PazCrc after the overlay PAZ is written.
/// 1. Computes paz_crc = hashlittle(paz_data, INTEGRITY_SEED)
/// 2. Writes paz_crc at pamt[16..20] (PazInfo CRC field)
/// 3. Recomputes header_crc = hashlittle(&pamt[12..], INTEGRITY_SEED)
/// 4. Writes header_crc at pamt[0..4]
fn update_pamt_paz_crc(pamt: &mut Vec<u8>, paz_data: &[u8]) {
    let paz_crc = hashlittle(paz_data, INTEGRITY_SEED);
    pamt[16..20].copy_from_slice(&paz_crc.to_le_bytes());
    let header_crc = hashlittle(&pamt[12..], INTEGRITY_SEED);
    pamt[0..4].copy_from_slice(&header_crc.to_le_bytes());
}

// =============================================================================
// PAMT Parser — read and search base game PAMT index files
// =============================================================================

/// A parsed file record from a PAMT index.
#[derive(Debug, Clone)]
struct PamtFileRecord {
    name_offset: u32,
    paz_offset: u32,
    comp_size: u32,
    decomp_size: u32,
    paz_index: u16,
    flags: u16,
}

/// Parsed PAMT structure with all blocks.
#[derive(Debug)]
struct PamtInfo {
    #[allow(dead_code)]
    header_crc: u32,
    #[allow(dead_code)]
    paz_count: u32,
    #[allow(dead_code)]
    unknown: u32,
    #[allow(dead_code)]
    paz_infos: Vec<(u32, u32, u32)>, // (index, crc, file_size)
    dir_data: Vec<u8>,
    fn_data: Vec<u8>,
    hash_entries: Vec<(u32, u32, u32, u32)>, // (folder_hash, name_offset, file_start, file_count)
    file_records: Vec<PamtFileRecord>,
}

/// Parse a PAMT file. Port of read_pamt from parse_pamt.py.
fn read_pamt(data: &[u8]) -> Result<PamtInfo, String> {
    if data.len() < 12 {
        return Err("PAMT too small for header".to_string());
    }

    let header_crc = u32::from_le_bytes(data[0..4].try_into().unwrap());
    let paz_count = u32::from_le_bytes(data[4..8].try_into().unwrap());
    let unknown = u32::from_le_bytes(data[8..12].try_into().unwrap());

    let mut pos = 12usize;
    let mut paz_infos = Vec::new();
    for _ in 0..paz_count {
        if pos + 12 > data.len() {
            return Err("PAMT truncated in PazInfo block".to_string());
        }
        let idx = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap());
        let crc = u32::from_le_bytes(data[pos + 4..pos + 8].try_into().unwrap());
        let fsize = u32::from_le_bytes(data[pos + 8..pos + 12].try_into().unwrap());
        paz_infos.push((idx, crc, fsize));
        pos += 12;
    }

    // Directory block
    if pos + 4 > data.len() {
        return Err("PAMT truncated before dir block size".to_string());
    }
    let dir_size = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
    pos += 4;
    if pos + dir_size > data.len() {
        return Err("PAMT truncated in dir block".to_string());
    }
    let dir_data = data[pos..pos + dir_size].to_vec();
    pos += dir_size;

    // Filename block
    if pos + 4 > data.len() {
        return Err("PAMT truncated before fn block size".to_string());
    }
    let fn_size = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
    pos += 4;
    if pos + fn_size > data.len() {
        return Err("PAMT truncated in fn block".to_string());
    }
    let fn_data = data[pos..pos + fn_size].to_vec();
    pos += fn_size;

    // Hash table
    if pos + 4 > data.len() {
        return Err("PAMT truncated before hash count".to_string());
    }
    let hash_count = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
    pos += 4;
    let mut hash_entries = Vec::new();
    for _ in 0..hash_count {
        if pos + 16 > data.len() {
            return Err("PAMT truncated in hash table".to_string());
        }
        let folder_hash = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap());
        let name_offset = u32::from_le_bytes(data[pos + 4..pos + 8].try_into().unwrap());
        let file_start = u32::from_le_bytes(data[pos + 8..pos + 12].try_into().unwrap());
        let file_count = u32::from_le_bytes(data[pos + 12..pos + 16].try_into().unwrap());
        hash_entries.push((folder_hash, name_offset, file_start, file_count));
        pos += 16;
    }

    // File records
    if pos + 4 > data.len() {
        return Err("PAMT truncated before file count".to_string());
    }
    let file_count = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap()) as usize;
    pos += 4;
    let mut file_records = Vec::new();
    for _ in 0..file_count {
        if pos + 20 > data.len() {
            return Err("PAMT truncated in file records".to_string());
        }
        let name_offset = u32::from_le_bytes(data[pos..pos + 4].try_into().unwrap());
        let paz_offset = u32::from_le_bytes(data[pos + 4..pos + 8].try_into().unwrap());
        let comp_size = u32::from_le_bytes(data[pos + 8..pos + 12].try_into().unwrap());
        let decomp_size = u32::from_le_bytes(data[pos + 12..pos + 16].try_into().unwrap());
        let paz_index = u16::from_le_bytes(data[pos + 16..pos + 18].try_into().unwrap());
        let flags = u16::from_le_bytes(data[pos + 18..pos + 20].try_into().unwrap());
        file_records.push(PamtFileRecord {
            name_offset,
            paz_offset,
            comp_size,
            decomp_size,
            paz_index,
            flags,
        });
        pos += 20;
    }

    Ok(PamtInfo {
        header_crc,
        paz_count,
        unknown,
        paz_infos,
        dir_data,
        fn_data,
        hash_entries,
        file_records,
    })
}

/// Resolve a name from a linked-list name block (dir or filename).
/// Each entry: [ParentOffset:4][NameLen:1][NameBytes:NameLen]
/// ParentOffset = 0xFFFFFFFF means root. Walk parent chain, collect segments, reverse.
fn resolve_name(block_data: &[u8], name_offset: u32) -> String {
    let mut segments: Vec<String> = Vec::new();
    let mut offset = name_offset as usize;
    let mut guard = 0;

    while offset != 0xFFFFFFFF_usize && guard < 64 {
        if offset + 5 > block_data.len() {
            break;
        }
        let parent = u32::from_le_bytes(block_data[offset..offset + 4].try_into().unwrap());
        let name_len = block_data[offset + 4] as usize;
        if offset + 5 + name_len > block_data.len() {
            break;
        }
        let seg = String::from_utf8_lossy(&block_data[offset + 5..offset + 5 + name_len]).to_string();
        segments.push(seg);
        offset = if parent == 0xFFFFFFFF { 0xFFFFFFFF_usize } else { parent as usize };
        guard += 1;
    }

    segments.reverse();
    segments.join("")
}

/// Build a full path index: "dir_path/filename" -> PamtFileRecord for all files in a PAMT.
fn build_file_index(pamt: &PamtInfo) -> HashMap<String, PamtFileRecord> {
    let mut index = HashMap::new();

    // Build folder_hash -> dir_name mapping
    let mut dir_names: HashMap<u32, String> = HashMap::new();
    for &(folder_hash, name_offset, _, _) in &pamt.hash_entries {
        dir_names.insert(folder_hash, resolve_name(&pamt.dir_data, name_offset));
    }

    // Map each file record to its directory via hash entries
    for (i, rec) in pamt.file_records.iter().enumerate() {
        let filename = resolve_name(&pamt.fn_data, rec.name_offset);
        for &(folder_hash, _, file_start, file_count) in &pamt.hash_entries {
            let start = file_start as usize;
            let count = file_count as usize;
            if i >= start && i < start + count {
                let dirname = dir_names.get(&folder_hash).cloned().unwrap_or_default();
                let full_path = if dirname.is_empty() {
                    filename.clone()
                } else {
                    format!("{}/{}", dirname, filename)
                };
                index.insert(full_path, rec.clone());
                break;
            }
        }
    }

    index
}

/// Search ALL numbered game directories (0000-0035) for a target file.
/// Returns (group_id, full_path, record) or an error if not found.
/// Port of find_file_in_game from the Python apply_mods.py.
fn find_file_in_game(game_path: &str, target_file: &str) -> Result<(String, String, PamtFileRecord), String> {
    let target_lower = target_file.to_lowercase().replace('\\', "/");
    let target_basename = target_lower.rsplit('/').next().unwrap_or(&target_lower);

    let game_dir = Path::new(game_path);
    let mut basename_match: Option<(String, String, PamtFileRecord)> = None;
    let mut basename_ambiguous = false;

    // Collect and sort numbered directories
    let mut dirs: Vec<_> = match fs::read_dir(game_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                e.path().is_dir() && name.chars().all(|c| c.is_ascii_digit()) && name != "0036"
            })
            .collect(),
        Err(_) => return Err(format!("Cannot read game directory: {}", game_path)),
    };
    dirs.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    for entry in &dirs {
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let pamt_path = entry.path().join("0.pamt");
        if !pamt_path.exists() {
            continue;
        }

        let data = match fs::read(&pamt_path) {
            Ok(d) => d,
            Err(_) => continue,
        };
        let pamt_info = match read_pamt(&data) {
            Ok(p) => p,
            Err(_) => continue,
        };
        let file_idx = build_file_index(&pamt_info);

        for (path, rec) in &file_idx {
            let ep = path.to_lowercase().replace('\\', "/");

            // Exact match
            if ep == target_lower {
                return Ok((dir_name, path.clone(), rec.clone()));
            }
            // PAMT path is suffix of target
            if target_lower.ends_with(&format!("/{}", ep)) || target_lower.ends_with(&ep) {
                return Ok((dir_name, path.clone(), rec.clone()));
            }
            // Target is suffix of PAMT path
            if ep.ends_with(&format!("/{}", target_lower)) {
                return Ok((dir_name, path.clone(), rec.clone()));
            }
            // Basename match (last resort)
            let ep_basename = ep.rsplit('/').next().unwrap_or(&ep);
            if ep_basename == target_basename {
                if basename_match.is_none() && !basename_ambiguous {
                    basename_match = Some((dir_name.clone(), path.clone(), rec.clone()));
                } else {
                    basename_ambiguous = true;
                    basename_match = None;
                }
            }
        }
    }

    if let Some(m) = basename_match {
        return Ok(m);
    }

    Err(format!("'{}' not found in any PAMT index", target_file))
}

/// Extract a file from a game PAZ archive given its group directory and record.
/// Reads compressed data from {group_id}/{paz_index}.paz and decompresses it.
fn extract_from_paz(game_path: &str, group_id: &str, rec: &PamtFileRecord, filename: &str) -> Result<Vec<u8>, String> {
    let group_dir = Path::new(game_path).join(group_id);
    let paz_path = group_dir.join(format!("{}.paz", rec.paz_index));

    if !paz_path.exists() {
        return Err(format!("PAZ file not found: {}", paz_path.display()));
    }

    let mut paz_file = fs::File::open(&paz_path)
        .map_err(|e| format!("Failed to open PAZ: {}", e))?;
    use std::io::Seek;
    paz_file.seek(std::io::SeekFrom::Start(rec.paz_offset as u64))
        .map_err(|e| format!("Failed to seek in PAZ: {}", e))?;
    let mut raw = vec![0u8; rec.comp_size as usize];
    paz_file.read_exact(&mut raw)
        .map_err(|e| format!("Failed to read from PAZ: {}", e))?;

    if raw.len() != rec.comp_size as usize {
        return Err(format!(
            "Short read: got {} bytes, expected {}",
            raw.len(), rec.comp_size
        ));
    }

    // Check encryption (flags >> 4 != 0 means encrypted)
    if (rec.flags >> 4) != 0 {
        return Err(format!(
            "File '{}' is encrypted (flags=0x{:04X}). Encrypted base files are not yet supported.",
            filename, rec.flags
        ));
    }

    // Decompress if sizes differ
    if rec.comp_size != rec.decomp_size {
        let decompressed = lz4::block::decompress(&raw, Some(rec.decomp_size as i32))
            .map_err(|e| format!("LZ4 decompression failed for '{}': {}", filename, e))?;
        Ok(decompressed)
    } else {
        Ok(raw)
    }
}

// =============================================================================
// build_multi_pamt — construct overlay PAMT for multiple files
// Port of build_multi_pamt from parse_pamt.py (verified byte-identical output)
// =============================================================================

/// Info for one file to include in the overlay PAMT/PAZ.
struct OverlayFileInfo {
    dir_path: String,    // e.g. "gamedata/binary__/client/bin"
    filename: String,    // e.g. "storeinfo.pabgb"
    paz_offset: u32,     // offset within the concatenated PAZ
    comp_size: u32,      // compressed size in PAZ
    decomp_size: u32,    // decompressed size
    flags: u16,          // compression/encryption flags (0x0002 = LZ4)
}

/// Build a complete PAMT binary for the overlay with multiple files.
/// Exact port of build_multi_pamt from the verified Python implementation.
fn build_multi_pamt(files: &[OverlayFileInfo], paz_data_len: u32) -> Vec<u8> {
    // ---- Build directory block ----
    let mut dir_block: Vec<u8> = Vec::new();
    let mut dir_offsets: HashMap<String, u32> = HashMap::new();

    // Collect unique directory paths, sorted
    let mut all_dirs: Vec<String> = files.iter().map(|f| f.dir_path.clone()).collect();
    all_dirs.sort();
    all_dirs.dedup();

    for dir_path in &all_dirs {
        let parts: Vec<&str> = dir_path.split('/').collect();
        for depth in 0..parts.len() {
            let key: String = parts[..=depth].join("/");
            if !dir_offsets.contains_key(&key) {
                let offset_in_block = dir_block.len() as u32;
                dir_offsets.insert(key.clone(), offset_in_block);

                let (parent_offset, segment) = if depth == 0 {
                    (0xFFFFFFFFu32, parts[depth].to_string())
                } else {
                    let parent_key: String = parts[..depth].join("/");
                    let parent_off = *dir_offsets.get(&parent_key).unwrap();
                    (parent_off, format!("/{}", parts[depth]))
                };

                let seg_bytes = segment.as_bytes();
                dir_block.extend_from_slice(&parent_offset.to_le_bytes());
                dir_block.push(seg_bytes.len() as u8);
                dir_block.extend_from_slice(seg_bytes);
            }
        }
    }

    // ---- Build filename block + hash entries + file records ----
    let mut fn_block: Vec<u8> = Vec::new();
    let mut hash_entries_data: Vec<Vec<u8>> = Vec::new();
    let mut file_records_data: Vec<Vec<u8>> = Vec::new();

    // Group files by directory (sorted), preserving order
    let mut grouped: Vec<(String, Vec<&OverlayFileInfo>)> = Vec::new();
    {
        let mut seen: Vec<String> = Vec::new();
        for f in files {
            if let Some(entry) = grouped.iter_mut().find(|(d, _)| d == &f.dir_path) {
                entry.1.push(f);
            } else {
                seen.push(f.dir_path.clone());
                grouped.push((f.dir_path.clone(), vec![f]));
            }
        }
        grouped.sort_by(|a, b| a.0.cmp(&b.0));
    }

    let mut file_idx: u32 = 0;
    for (dir_path, dir_files) in &grouped {
        let folder_hash = hashlittle(dir_path.as_bytes(), INTEGRITY_SEED);
        let dir_name_offset = *dir_offsets.get(dir_path).unwrap();
        let start_index = file_idx;

        for f in dir_files {
            let fn_offset = fn_block.len() as u32;
            // Filename entry: [parent:4=0xFFFFFFFF][len:1][name_bytes]
            let fn_bytes = f.filename.as_bytes();
            fn_block.extend_from_slice(&0xFFFFFFFFu32.to_le_bytes());
            fn_block.push(fn_bytes.len() as u8);
            fn_block.extend_from_slice(fn_bytes);

            // File record: [NameOff:4][PazOff:4][CompSize:4][DecompSize:4][PazIndex:2=0][Flags:2]
            let mut rec = Vec::with_capacity(20);
            rec.extend_from_slice(&fn_offset.to_le_bytes());
            rec.extend_from_slice(&f.paz_offset.to_le_bytes());
            rec.extend_from_slice(&f.comp_size.to_le_bytes());
            rec.extend_from_slice(&f.decomp_size.to_le_bytes());
            rec.extend_from_slice(&0u16.to_le_bytes()); // paz_index = 0
            rec.extend_from_slice(&f.flags.to_le_bytes());
            file_records_data.push(rec);

            file_idx += 1;
        }

        // Hash entry: [FolderHash:4][NameOffset:4][FileStartIndex:4][FileCount:4]
        let mut he = Vec::with_capacity(16);
        he.extend_from_slice(&folder_hash.to_le_bytes());
        he.extend_from_slice(&dir_name_offset.to_le_bytes());
        he.extend_from_slice(&start_index.to_le_bytes());
        he.extend_from_slice(&(dir_files.len() as u32).to_le_bytes());
        hash_entries_data.push(he);
    }

    // ---- Assemble inner PAMT (everything after HeaderCrc) ----
    let mut inner: Vec<u8> = Vec::new();
    inner.extend_from_slice(&1u32.to_le_bytes());             // PazCount = 1
    inner.extend_from_slice(&0x610E0232u32.to_le_bytes());    // Unknown/magic
    inner.extend_from_slice(&0u32.to_le_bytes());             // PazInfo: Index = 0
    inner.extend_from_slice(&0u32.to_le_bytes());             // PazInfo: Crc = 0 (placeholder)
    inner.extend_from_slice(&paz_data_len.to_le_bytes());     // PazInfo: FileSize

    // Dir block
    inner.extend_from_slice(&(dir_block.len() as u32).to_le_bytes());
    inner.extend_from_slice(&dir_block);

    // Filename block
    inner.extend_from_slice(&(fn_block.len() as u32).to_le_bytes());
    inner.extend_from_slice(&fn_block);

    // Hash entries
    inner.extend_from_slice(&(hash_entries_data.len() as u32).to_le_bytes());
    for h in &hash_entries_data {
        inner.extend_from_slice(h);
    }

    // File records
    inner.extend_from_slice(&(file_records_data.len() as u32).to_le_bytes());
    for r in &file_records_data {
        inner.extend_from_slice(r);
    }

    // Final PAMT: [HeaderCrc:4][inner...]
    // Write placeholder HeaderCrc (0), then compute using compute_pamt_hash
    let mut pamt = Vec::with_capacity(4 + inner.len());
    pamt.extend_from_slice(&0u32.to_le_bytes()); // placeholder
    pamt.extend_from_slice(&inner);

    // Compute HeaderCrc = hashlittle(pamt[12..], INTEGRITY_SEED)
    let header_crc = compute_pamt_hash(&pamt);
    pamt[0..4].copy_from_slice(&header_crc.to_le_bytes());

    pamt
}

// =============================================================================
// build_papgt_with_overlay — construct a PAPGT with the 0036 overlay entry
// =============================================================================

/// Build a complete PAPGT binary that includes the 0036 overlay entry.
///
/// PAPGT structure:
///   [PlatformMagic:4][Hash:4][EntryCount:1][LangType:2][Zero:1]  (12-byte header)
///   [Entry0..N: IsOptional:1, LangType:2, Zero:1, NameOffset:4, PamtCrc:4]  (12 bytes each)
///   [NamesBlockLength:4]
///   [NullTerminatedNames...]
///
/// The Hash at offset 4 = hashlittle(papgt[12..], INTEGRITY_SEED) — everything after the 12-byte header.
/// The 0036 entry: IsOptional=0, LangType=0x3FFF, Zero=0, NameOffset=<computed>, PamtCrc=<pamt_header_crc>.
fn build_papgt_with_overlay(clean_papgt: &[u8], pamt_header_crc: u32) -> Result<Vec<u8>, String> {
    if clean_papgt.len() < 12 {
        return Err("Clean PAPGT is too small (< 12 bytes)".to_string());
    }

    // Parse the clean PAPGT header
    let platform_magic = u32::from_le_bytes(clean_papgt[0..4].try_into().unwrap());
    // clean_papgt[4..8] is the old hash — we will recompute
    let entry_count = clean_papgt[8] as usize;
    let lang_type = u16::from_le_bytes(clean_papgt[9..11].try_into().unwrap());
    let zero_byte = clean_papgt[11];

    let entries_start = 12;
    let entries_end = entries_start + entry_count * 12;

    if clean_papgt.len() < entries_end + 4 {
        return Err(format!(
            "Clean PAPGT too small for {} entries (need {} bytes, have {})",
            entry_count,
            entries_end + 4,
            clean_papgt.len()
        ));
    }

    // Parse existing entries
    let mut entries: Vec<(u8, u16, u8, u32, u32)> = Vec::new(); // (is_optional, lang_type, zero, name_offset, pamt_crc)
    for i in 0..entry_count {
        let base = entries_start + i * 12;
        let is_optional = clean_papgt[base];
        let e_lang = u16::from_le_bytes(clean_papgt[base + 1..base + 3].try_into().unwrap());
        let e_zero = clean_papgt[base + 3];
        let name_offset = u32::from_le_bytes(clean_papgt[base + 4..base + 8].try_into().unwrap());
        let pamt_crc = u32::from_le_bytes(clean_papgt[base + 8..base + 12].try_into().unwrap());
        entries.push((is_optional, e_lang, e_zero, name_offset, pamt_crc));
    }

    // Read the names block
    let names_block_len = u32::from_le_bytes(
        clean_papgt[entries_end..entries_end + 4].try_into().unwrap(),
    ) as usize;
    let names_start = entries_end + 4;
    let names_end = names_start + names_block_len;

    if clean_papgt.len() < names_end {
        return Err(format!(
            "Clean PAPGT names block extends past end (names_end={}, file_len={})",
            names_end,
            clean_papgt.len()
        ));
    }

    let mut names_block = clean_papgt[names_start..names_end].to_vec();

    // Check if 0036 already exists in the names
    let overlay_name = b"0036\0";
    let mut overlay_name_offset: Option<u32> = None;

    // Scan existing names for "0036"
    let mut pos = 0;
    while pos < names_block.len() {
        let end = names_block[pos..].iter().position(|&b| b == 0).unwrap_or(names_block.len() - pos);
        let name = &names_block[pos..pos + end];
        if name == b"0036" {
            overlay_name_offset = Some(pos as u32);
            break;
        }
        pos += end + 1; // skip past null terminator
    }

    // Check if an entry for 0036 already exists
    let already_has_overlay = if let Some(offset) = overlay_name_offset {
        entries.iter().any(|(_, _, _, no, _)| *no == offset)
    } else {
        false
    };

    if already_has_overlay {
        // 0036 entry already exists — update the PamtCrc and recompute hash
        let offset_val = overlay_name_offset.unwrap();
        for entry in entries.iter_mut() {
            if entry.3 == offset_val {
                entry.4 = pamt_header_crc;
            }
        }
    } else {
        // Prepend "0036\0" to the names block and shift all existing name offsets
        let mut new_names_block = Vec::new();
        new_names_block.extend_from_slice(overlay_name);
        new_names_block.extend_from_slice(&names_block);
        let shift = overlay_name.len() as u32; // 5 bytes for "0036\0"

        // Shift all existing entries' name offsets
        for entry in entries.iter_mut() {
            entry.3 += shift;
        }

        names_block = new_names_block;

        // Insert the 0036 entry at the front: IsOptional=0, LangType=0x3FFF, Zero=0, NameOffset=0
        entries.insert(0, (0, 0x3FFF, 0, 0, pamt_header_crc));
    }

    // Rebuild the PAPGT binary
    let new_entry_count = entries.len();
    let new_names_block_len = names_block.len() as u32;

    // Body = entries + names_block_length + names_block
    let body_size = new_entry_count * 12 + 4 + names_block.len();
    let mut body = Vec::with_capacity(body_size);

    for (is_optional, e_lang, e_zero, name_offset, pamt_crc) in &entries {
        body.push(*is_optional);
        body.extend_from_slice(&e_lang.to_le_bytes());
        body.push(*e_zero);
        body.extend_from_slice(&name_offset.to_le_bytes());
        body.extend_from_slice(&pamt_crc.to_le_bytes());
    }

    body.extend_from_slice(&new_names_block_len.to_le_bytes());
    body.extend_from_slice(&names_block);

    // Build the complete PAPGT with placeholder hash, then compute via compute_papgt_hash
    let total_size = 12 + body.len();
    let mut papgt = Vec::with_capacity(total_size);
    papgt.extend_from_slice(&platform_magic.to_le_bytes());
    papgt.extend_from_slice(&0u32.to_le_bytes()); // placeholder hash
    papgt.push(new_entry_count as u8);
    papgt.extend_from_slice(&lang_type.to_le_bytes());
    papgt.push(zero_byte);
    papgt.extend_from_slice(&body);

    // Compute hash = hashlittle(papgt[12..], INTEGRITY_SEED) and write at offset 4
    let hash = compute_papgt_hash(&papgt);
    papgt[4..8].copy_from_slice(&hash.to_le_bytes());

    Ok(papgt)
}

#[tauri::command]
pub fn apply_mods(
    game_path: String,
    mods_path: String,
    active_mods: Vec<ActiveMod>,
    backup_dir: String,
    browser_mod_folders: Option<Vec<String>>,
) -> Result<ApplyResult, String> {
    let mut result = ApplyResult {
        success: true,
        applied: Vec::new(),
        errors: Vec::new(),
        backup_created: false,
    };

    let backup_path = Path::new(&backup_dir);

    // Ensure backup directory exists
    if !backup_path.exists() {
        fs::create_dir_all(backup_path)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    // Collect all patches grouped by game file
    let mut file_patches: HashMap<String, Vec<(String, Vec<ModChange>)>> = HashMap::new();

    for active_mod in &active_mods {
        let path = Path::new(&mods_path).join(&active_mod.file_name);
        match parse_mod_file(&path) {
            Ok(mod_file) => {
                let (title, _, _, _) = get_mod_display_info(&mod_file);
                for patch in &mod_file.patches {
                    let changes: Vec<ModChange> = patch.changes.iter()
                        .enumerate()
                        .filter(|(i, _)| !active_mod.disabled_indices.contains(i))
                        .map(|(_, c)| c.clone())
                        .collect();

                    if !changes.is_empty() {
                        file_patches.entry(patch.game_file.clone())
                            .or_default()
                            .push((title.clone(), changes));
                    }
                }
            }
            Err(e) => {
                result.errors.push(format!("{}: {}", active_mod.file_name, e));
                result.success = false;
            }
        }
    }

    // Separate pabgb files (PAZ overlay) from regular files
    let mut pabgb_patches: Vec<(String, Vec<(String, Vec<ModChange>)>)> = Vec::new();
    let mut regular_patches: Vec<(String, Vec<(String, Vec<ModChange>)>)> = Vec::new();

    for (game_file, mod_patches) in &file_patches {
        let is_pabgb = game_file.starts_with("gamedata/") || game_file.ends_with(".pabgb");
        if is_pabgb {
            pabgb_patches.push((game_file.clone(), mod_patches.clone()));
        } else {
            regular_patches.push((game_file.clone(), mod_patches.clone()));
        }
    }

    // === Collect file replacement mod files ===
    // Supports two layouts:
    //   1. manifest.json + files/{group}/{path} (manifest-based)
    //   2. {group}/{path} directly in the mod folder (loose folder)
    let mut browser_overlay_files: Vec<(String, String, Vec<u8>)> = Vec::new(); // (dir_path, filename, raw_data)

    fn collect_overlay_files(base: &Path, results: &mut Vec<(String, String, Vec<u8>)>) {
        fn recurse(dir: &Path, base: &Path, results: &mut Vec<(String, String, Vec<u8>)>) {
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.filter_map(|e| e.ok()) {
                    let p = e.path();
                    if p.is_dir() {
                        recurse(&p, base, results);
                    } else if p.is_file() {
                        if let Ok(rel) = p.strip_prefix(base) {
                            let rel_str = rel.to_string_lossy().replace('\\', "/");
                            // Strip group number prefix: "0012/ui/texture/file.dds" → dir="ui/texture", file="file.dds"
                            let parts: Vec<&str> = rel_str.splitn(2, '/').collect();
                            if parts.len() == 2 {
                                let inner_path = parts[1];
                                if let Some(last_slash) = inner_path.rfind('/') {
                                    if let Ok(data) = fs::read(&p) {
                                        results.push((inner_path[..last_slash].to_string(), inner_path[last_slash + 1..].to_string(), data));
                                    }
                                } else if let Ok(data) = fs::read(&p) {
                                    results.push(("".to_string(), inner_path.to_string(), data));
                                }
                            }
                        }
                    }
                }
            }
        }
        recurse(base, base, results);
    }

    // Standalone overlay mods: mods that ship pre-built 0036/ PAZ/PAMT
    let mut standalone_paz_data: Option<Vec<u8>> = None;
    let mut standalone_pamt_data: Option<Vec<u8>> = None;

    if let Some(ref folders) = browser_mod_folders {
        let mods_dir = Path::new(&mods_path);
        for folder_name in folders {
            let mod_dir = mods_dir.join(folder_name);

            // Check for standalone overlay mod (has 0036/0.paz and 0036/0.pamt)
            let standalone_paz = mod_dir.join("0036").join("0.paz");
            let standalone_pamt = mod_dir.join("0036").join("0.pamt");
            if standalone_paz.exists() && standalone_pamt.exists() {
                let paz = fs::read(&standalone_paz)
                    .map_err(|e| format!("Failed to read standalone PAZ from {}: {}", folder_name, e))?;
                let pamt = fs::read(&standalone_pamt)
                    .map_err(|e| format!("Failed to read standalone PAMT from {}: {}", folder_name, e))?;

                // If we already have standalone data, append (concatenate PAZ, use latest PAMT)
                if let Some(ref mut existing_paz) = standalone_paz_data {
                    existing_paz.extend_from_slice(&paz);
                    standalone_pamt_data = Some(pamt);
                } else {
                    standalone_paz_data = Some(paz);
                    standalone_pamt_data = Some(pamt);
                }

                result.applied.push(folder_name.clone());
                continue; // Don't process as a regular browser mod
            }

            let before = browser_overlay_files.len();

            // Check for manifest.json or mod.json → use files/ subdir
            for manifest_name in &["manifest.json", "mod.json"] {
                let manifest_path = mod_dir.join(manifest_name);
                if manifest_path.exists() {
                    if let Ok(data) = fs::read_to_string(&manifest_path) {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                            let files_dir_name = v.get("files_dir").and_then(|f| f.as_str()).unwrap_or("files");
                            let files_dir = mod_dir.join(files_dir_name);
                            if files_dir.exists() {
                                collect_overlay_files(&files_dir, &mut browser_overlay_files);
                                break;
                            }
                        }
                    }
                }
            }

            // If manifest didn't yield files, try loose folder layout (numbered dirs directly)
            if browser_overlay_files.len() == before {
                let has_group = fs::read_dir(&mod_dir).ok()
                    .map(|rd| rd.filter_map(|e| e.ok())
                        .any(|e| e.path().is_dir() && is_paz_group_dir(&e.file_name().to_string_lossy())))
                    .unwrap_or(false);
                if has_group {
                    collect_overlay_files(&mod_dir, &mut browser_overlay_files);
                }
            }

            if browser_overlay_files.len() > before {
                result.applied.push(folder_name.clone());
            }
        }
    }
    let has_browser_mods = !browser_overlay_files.is_empty();
    let has_standalone = standalone_paz_data.is_some();

    // === STANDALONE OVERLAY MOD PIPELINE ===
    // If a standalone mod provides pre-built 0036/ files, copy them directly
    if has_standalone && pabgb_patches.is_empty() && !has_browser_mods {
        let overlay_dir = Path::new(&game_path).join("0036");
        let papgt_path = Path::new(&game_path).join("meta").join("0.papgt");

        if !overlay_dir.exists() {
            fs::create_dir_all(&overlay_dir)
                .map_err(|e| format!("Failed to create overlay directory 0036: {}", e))?;
        }

        // Backup PAPGT
        let papgt_backup = backup_path.join("papgt_clean.bin");
        if !papgt_backup.exists() && papgt_path.exists() {
            fs::copy(&papgt_path, &papgt_backup)
                .map_err(|e| format!("Failed to backup PAPGT: {}", e))?;
        }

        // Write standalone PAZ and PAMT
        let paz = standalone_paz_data.as_ref().unwrap();
        let pamt = standalone_pamt_data.as_ref().unwrap();

        fs::write(overlay_dir.join("0.paz"), paz)
            .map_err(|e| format!("Failed to write standalone PAZ: {}", e))?;
        fs::write(overlay_dir.join("0.pamt"), pamt)
            .map_err(|e| format!("Failed to write standalone PAMT: {}", e))?;

        // Build PAPGT with 0036 entry
        let clean_papgt = fs::read(&papgt_backup)
            .map_err(|e| format!("Failed to read clean PAPGT: {}", e))?;

        // Compute PAMT header CRC for the PAPGT entry
        let pamt_header_crc = hashlittle(&pamt[12..], INTEGRITY_SEED);

        let new_papgt = build_papgt_with_overlay(&clean_papgt, pamt_header_crc)?;
        fs::write(&papgt_path, &new_papgt)
            .map_err(|e| format!("Failed to write PAPGT: {}", e))?;

        log::info!("Standalone overlay mod mounted: {} bytes PAZ, {} bytes PAMT", paz.len(), pamt.len());
    }

    // === MULTI-FILE PAZ OVERLAY PIPELINE ===
    if !pabgb_patches.is_empty() || has_browser_mods {
        let overlay_dir = Path::new(&game_path).join("0036");
        let overlay_paz = overlay_dir.join("0.paz");
        let overlay_pamt = overlay_dir.join("0.pamt");
        let papgt_path = Path::new(&game_path).join("meta").join("0.papgt");

        // Ensure overlay directory exists
        if !overlay_dir.exists() {
            fs::create_dir_all(&overlay_dir)
                .map_err(|e| format!("Failed to create overlay directory 0036: {}", e))?;
        }

        // Backup overlay PAZ (only first time, if it exists)
        let paz_backup = backup_path.join("overlay_clean.paz");
        if !paz_backup.exists() && overlay_paz.exists() {
            fs::copy(&overlay_paz, &paz_backup)
                .map_err(|e| format!("Failed to backup overlay PAZ: {}", e))?;
            result.backup_created = true;
        }
        // Backup overlay PAMT (only first time, if it exists)
        let pamt_backup = backup_path.join("overlay_clean.pamt");
        if !pamt_backup.exists() && overlay_pamt.exists() {
            fs::copy(&overlay_pamt, &pamt_backup)
                .map_err(|e| format!("Failed to backup overlay PAMT: {}", e))?;
        }
        // Backup PAPGT (only first time)
        let papgt_backup = backup_path.join("papgt_clean.bin");
        if !papgt_backup.exists() && papgt_path.exists() {
            fs::copy(&papgt_path, &papgt_backup)
                .map_err(|e| format!("Failed to backup PAPGT: {}", e))?;
        }

        // Process each pabgb file: extract clean data, apply patches, compress
        // Collect results for building the combined PAZ and PAMT
        let mut overlay_files: Vec<OverlayFileInfo> = Vec::new();
        let mut paz_data: Vec<u8> = Vec::new();
        let mut had_pabgb_error = false;

        // Sort pabgb_patches for deterministic output
        pabgb_patches.sort_by(|a, b| a.0.cmp(&b.0));

        for (game_file, mod_patches) in &pabgb_patches {
            // Extract the bare filename from the game_file path
            // e.g. "gamedata/binary__/client/bin/storeinfo.pabgb" -> "storeinfo.pabgb"
            let bare_filename = game_file.rsplit('/').next().unwrap_or(game_file);

            // All pabgb files live at gamedata/binary__/client/bin/ regardless of
            // what the mod JSON says (mods use shortened paths like "gamedata/storeinfo.pabgb")
            let dir_path = "gamedata/binary__/client/bin";

            // Sanitized name for backup file (replace / with _)
            let clean_name = bare_filename.replace(".pabgb", "_clean.bin");
            let clean_backup = backup_path.join(&clean_name);

            // Check if a file replacement mod provides this pabgb file
            // If so, use that as base instead of vanilla (cross-format merge)
            let browser_base: Option<Vec<u8>> = browser_overlay_files.iter()
                .find(|(_, fname, _)| fname.eq_ignore_ascii_case(bare_filename))
                .map(|(_, _, data)| data.clone());

            // Get decompressed data — prefer file replacement base, then clean backup, then extract from PAZ
            let flat_data_result: Result<Vec<u8>, String> = if let Some(base_data) = browser_base {
                log::info!("Using file replacement base for {} ({} bytes), will apply JSON patches on top", bare_filename, base_data.len());
                Ok(base_data)
            } else if clean_backup.exists() {
                // Read from existing clean backup
                log::info!("Using cached clean {}", bare_filename);
                fs::read(&clean_backup)
                    .map_err(|e| format!("Failed to read clean backup for {}: {}", bare_filename, e))
            } else {
                // Search ALL game directories for this file (port of Python find_file_in_game)
                match find_file_in_game(&game_path, game_file) {
                    Ok((group_id, full_path, rec)) => {
                        log::info!(
                            "Found {} in group {}: comp={}, decomp={}, flags=0x{:04X}",
                            full_path, group_id, rec.comp_size, rec.decomp_size, rec.flags
                        );
                        match extract_from_paz(&game_path, &group_id, &rec, bare_filename) {
                            Ok(data) => {
                                log::info!("Extracted clean {}: {} bytes", bare_filename, data.len());
                                // Cache the clean data
                                let _ = fs::write(&clean_backup, &data);
                                result.backup_created = true;
                                Ok(data)
                            }
                            Err(e) => Err(format!("Failed to extract {}: {}", bare_filename, e)),
                        }
                    }
                    Err(e) => Err(format!("Failed to find {}: {}", bare_filename, e)),
                }
            };

            let mut flat_data = match flat_data_result {
                Ok(data) => data,
                Err(e) => {
                    result.errors.push(e);
                    result.success = false;
                    had_pabgb_error = true;
                    continue;
                }
            };

            // Apply all patches to the flat decompressed data
            for (mod_name, changes) in mod_patches {
                for change in changes {
                    let offset = change.offset as usize;
                    let patched_bytes = hex::decode(&change.patched)
                        .map_err(|e| format!("Bad hex in {}: {}", mod_name, e))?;

                    if offset + patched_bytes.len() > flat_data.len() {
                        result.errors.push(format!(
                            "{}: offset {} exceeds {} size ({})",
                            mod_name, change.offset, bare_filename, flat_data.len()
                        ));
                        continue;
                    }

                    // Check if already patched (bytes already match target)
                    let current = &flat_data[offset..offset + patched_bytes.len()];
                    if current == patched_bytes.as_slice() {
                        continue; // Already applied, skip
                    }

                    // Verify original bytes match if provided — with pattern scan fallback
                    if !change.original.is_empty() {
                        if let Ok(orig_bytes) = hex::decode(&change.original) {
                            if current == orig_bytes.as_slice() {
                                // Original bytes match at expected offset — patch normally
                                flat_data[offset..offset + patched_bytes.len()].copy_from_slice(&patched_bytes);
                                continue;
                            }

                            // Offset mismatch — scan for the original bytes in the file
                            let mut found = false;
                            let data_len = flat_data.len();
                            let pattern_len = orig_bytes.len();

                            // For short patterns (<4 bytes), limit search to ±512 bytes
                            // around the original offset to avoid false matches.
                            // For longer patterns, scan the entire file.
                            let (scan_start, scan_end) = if pattern_len < 4 {
                                let window = 512usize;
                                (offset.saturating_sub(window), (offset + window).min(data_len))
                            } else {
                                (0, data_len)
                            };

                            // Find the closest match to the original offset
                            let mut best_match: Option<usize> = None;
                            let mut best_dist: usize = usize::MAX;
                            let mut sp = scan_start;
                            while sp + pattern_len <= scan_end {
                                if flat_data[sp..sp + pattern_len] == orig_bytes[..] {
                                    let dist = if sp > offset { sp - offset } else { offset - sp };
                                    if dist < best_dist {
                                        best_dist = dist;
                                        best_match = Some(sp);
                                    }
                                }
                                sp += 1;
                            }

                            if let Some(match_pos) = best_match {
                                flat_data[match_pos..match_pos + patched_bytes.len()].copy_from_slice(&patched_bytes);
                                result.errors.push(format!(
                                    "{}: pattern scan applied in {} — offset shifted from 0x{:X} to 0x{:X} (delta: {})",
                                    mod_name, bare_filename, offset, match_pos,
                                    if match_pos >= offset { format!("+{}", match_pos - offset) }
                                    else { format!("-{}", offset - match_pos) }
                                ));
                                found = true;
                            }

                            if !found {
                                // Check if patched bytes already exist nearby (already applied)
                                let (ps, pe) = if patched_bytes.len() < 4 {
                                    (offset.saturating_sub(512), (offset + 512).min(data_len))
                                } else {
                                    (0, data_len)
                                };
                                let mut patched_elsewhere = false;
                                let mut sp2 = ps;
                                while sp2 + patched_bytes.len() <= pe {
                                    if flat_data[sp2..sp2 + patched_bytes.len()] == patched_bytes[..] {
                                        patched_elsewhere = true;
                                        break;
                                    }
                                    sp2 += 1;
                                }
                                if patched_elsewhere {
                                    continue;
                                }
                                result.errors.push(format!(
                                    "{}: pattern not found in {} — mod may need updating for this game version",
                                    mod_name, bare_filename
                                ));
                            }
                            continue;
                        }
                    }

                    // No original bytes provided — patch directly at offset
                    flat_data[offset..offset + patched_bytes.len()].copy_from_slice(&patched_bytes);
                }
                // Track unique mod names applied
                if !result.applied.contains(mod_name) {
                    result.applied.push(mod_name.clone());
                }
            }

            // LZ4 compress the patched data
            let compressed = lz4::block::compress(&flat_data, None, false)
                .map_err(|e| format!("LZ4 compression failed for {}: {}", bare_filename, e))?;

            // Record the PAZ offset before padding
            let paz_offset = paz_data.len() as u32;
            let comp_size = compressed.len() as u32;
            let decomp_size = flat_data.len() as u32;

            // Append compressed data to PAZ, padded to 16-byte alignment
            paz_data.extend_from_slice(&compressed);
            let padded_size = (paz_data.len() + 15) & !15;
            paz_data.resize(padded_size, 0);

            overlay_files.push(OverlayFileInfo {
                dir_path: dir_path.to_string(),
                filename: bare_filename.to_string(),
                paz_offset,
                comp_size,
                decomp_size,
                flags: 0x0002, // LZ4 compressed
            });
        }

        // Add file replacement mod files to overlay (deduplicated — last mod wins)
        // Also skip files that were already handled by the pabgb pipeline
        let pabgb_filenames: std::collections::HashSet<String> = overlay_files.iter()
            .map(|f| f.filename.to_lowercase())
            .collect();

        // Dedup: keep last occurrence of each dir_path/filename combo
        let mut deduped_browser: std::collections::HashMap<String, (String, String, &Vec<u8>)> = std::collections::HashMap::new();
        for (dir_path, filename, raw_data) in &browser_overlay_files {
            let key = format!("{}/{}", dir_path, filename).to_lowercase();
            deduped_browser.insert(key, (dir_path.clone(), filename.clone(), raw_data));
        }

        for (_key, (dir_path, filename, raw_data)) in &deduped_browser {
            // Skip if this file was already built by the pabgb byte-patch pipeline
            if pabgb_filenames.contains(&filename.to_lowercase()) {
                continue;
            }

            let compressed = lz4::block::compress(raw_data, None, false)
                .unwrap_or_else(|_| raw_data.to_vec());

            let paz_offset = paz_data.len() as u32;
            let comp_size = compressed.len() as u32;
            let decomp_size = raw_data.len() as u32;

            paz_data.extend_from_slice(&compressed);
            let padded_size = (paz_data.len() + 15) & !15;
            paz_data.resize(padded_size, 0);

            let dp = if dir_path.is_empty() { "root".to_string() } else { dir_path.clone() };
            overlay_files.push(OverlayFileInfo {
                dir_path: dp,
                filename: filename.clone(),
                paz_offset,
                comp_size,
                decomp_size,
                flags: 0x0002,
            });
        }

        if had_pabgb_error && overlay_files.is_empty() {
            // All files failed, skip overlay writing
        } else if !overlay_files.is_empty() {
            // Build the multi-file PAMT
            let paz_total_len = paz_data.len() as u32;
            let mut new_pamt = build_multi_pamt(&overlay_files, paz_total_len);

            // Write PAZ to overlay directory
            fs::write(&overlay_paz, &paz_data)
                .map_err(|e| format!("Failed to write overlay PAZ: {}", e))?;

            // Update PAMT PazCrc from the written PAZ data, then recompute HeaderCrc
            update_pamt_paz_crc(&mut new_pamt, &paz_data);

            // Write PAMT to overlay directory
            fs::write(&overlay_pamt, &new_pamt)
                .map_err(|e| format!("Failed to write overlay PAMT: {}", e))?;

            log::info!(
                "Wrote overlay: {} files, PAZ={} bytes, PAMT={} bytes",
                overlay_files.len(), paz_data.len(), new_pamt.len()
            );

            // Build PAPGT with 0036 entry
            // The PAMT's HeaderCrc is the first 4 bytes
            let pamt_header_crc = u32::from_le_bytes(new_pamt[0..4].try_into().unwrap());

            // Read the clean PAPGT from backup (without 0036 entry)
            let clean_papgt_data = if papgt_backup.exists() {
                fs::read(&papgt_backup)
                    .map_err(|e| format!("Failed to read clean PAPGT backup: {}", e))?
            } else if papgt_path.exists() {
                fs::read(&papgt_path)
                    .map_err(|e| format!("Failed to read current PAPGT: {}", e))?
            } else {
                result.errors.push("No PAPGT found (neither backup nor current)".to_string());
                result.success = false;
                Vec::new()
            };

            if !clean_papgt_data.is_empty() {
                let new_papgt = build_papgt_with_overlay(&clean_papgt_data, pamt_header_crc)?;
                fs::write(&papgt_path, &new_papgt)
                    .map_err(|e| format!("Failed to write PAPGT: {}", e))?;
            }
        }
    }

    // === REGULAR FILE PATCHING (non-PAZ) ===
    for (game_file, mod_patches) in &regular_patches {
        let file_path = Path::new(&game_path).join(game_file);
        if !file_path.exists() {
            result.errors.push(format!("Game file not found: {}", game_file));
            result.success = false;
            continue;
        }

        match create_backup(game_path.clone(), game_file.clone(), backup_dir.clone()) {
            Ok(_) => result.backup_created = true,
            Err(e) => {
                result.errors.push(format!("Backup failed: {}", e));
                result.success = false;
                continue;
            }
        }

        let mut data = fs::read(&file_path)
            .map_err(|e| format!("Failed to read {}: {}", game_file, e))?;

        for (mod_name, changes) in mod_patches {
            for change in changes {
                let offset = change.offset as usize;
                let patched_bytes = hex::decode(&change.patched)
                    .map_err(|e| format!("Bad hex in {}: {}", mod_name, e))?;
                if offset + patched_bytes.len() > data.len() {
                    continue;
                }

                // Check if already patched
                let current = &data[offset..offset + patched_bytes.len()];
                if current == patched_bytes.as_slice() {
                    continue; // Already applied, skip
                }

                // Verify original bytes match if provided — with pattern scan fallback
                if !change.original.is_empty() {
                    if let Ok(orig_bytes) = hex::decode(&change.original) {
                        if current == orig_bytes.as_slice() {
                            data[offset..offset + patched_bytes.len()].copy_from_slice(&patched_bytes);
                            continue;
                        }

                        // Offset mismatch — scan for the original bytes
                        let mut found = false;
                        let data_len = data.len();
                        let pattern_len = orig_bytes.len();

                        let (scan_start, scan_end) = if pattern_len < 4 {
                            let window = 512usize;
                            (offset.saturating_sub(window), (offset + window).min(data_len))
                        } else {
                            (0, data_len)
                        };

                        let mut best_match: Option<usize> = None;
                        let mut best_dist: usize = usize::MAX;
                        let mut sp = scan_start;
                        while sp + pattern_len <= scan_end {
                            if data[sp..sp + pattern_len] == orig_bytes[..] {
                                let dist = if sp > offset { sp - offset } else { offset - sp };
                                if dist < best_dist {
                                    best_dist = dist;
                                    best_match = Some(sp);
                                }
                            }
                            sp += 1;
                        }

                        if let Some(match_pos) = best_match {
                            data[match_pos..match_pos + patched_bytes.len()].copy_from_slice(&patched_bytes);
                            result.errors.push(format!(
                                "{}: pattern scan applied in {} — offset shifted from 0x{:X} to 0x{:X} (delta: {})",
                                mod_name, game_file, offset, match_pos,
                                if match_pos >= offset { format!("+{}", match_pos - offset) }
                                else { format!("-{}", offset - match_pos) }
                            ));
                            found = true;
                        }

                        if !found {
                            let (ps, pe) = if patched_bytes.len() < 4 {
                                (offset.saturating_sub(512), (offset + 512).min(data_len))
                            } else {
                                (0, data_len)
                            };
                            let mut patched_elsewhere = false;
                            let mut sp2 = ps;
                            while sp2 + patched_bytes.len() <= pe {
                                if data[sp2..sp2 + patched_bytes.len()] == patched_bytes[..] {
                                    patched_elsewhere = true;
                                    break;
                                }
                                sp2 += 1;
                            }
                            if patched_elsewhere {
                                continue;
                            }
                            result.errors.push(format!(
                                "{}: pattern not found in {} — mod may need updating for this game version",
                                mod_name, game_file
                            ));
                        }
                        continue;
                    }
                }

                // No original bytes provided — patch directly at offset
                data[offset..offset + patched_bytes.len()].copy_from_slice(&patched_bytes);
            }
            if !result.applied.contains(mod_name) {
                result.applied.push(mod_name.clone());
            }
        }

        fs::write(&file_path, &data)
            .map_err(|e| format!("Failed to write {}: {}", game_file, e))?;
    }

    Ok(result)
}

#[tauri::command]
pub fn revert_mods(game_path: String, backup_dir: String) -> Result<Vec<String>, String> {
    let backup_path = Path::new(&backup_dir);
    if !backup_path.exists() {
        return Err("No backups directory found".to_string());
    }

    let game = Path::new(&game_path);
    let bin64 = game.join("bin64");
    let mut restored = Vec::new();

    // 1. Restore clean PAPGT
    let papgt_backup = backup_path.join("papgt_clean.bin");
    let papgt_path = game.join("meta").join("0.papgt");
    if papgt_backup.exists() {
        fs::copy(&papgt_backup, &papgt_path)
            .map_err(|e| format!("Failed to restore PAPGT: {}", e))?;
        restored.push("Restored: PAPGT".to_string());
    } else {
        return Err("No clean PAPGT backup found. Run 'Initialize' first.".to_string());
    }

    // 2. Restore clean PATHC
    let pathc_path = game.join("meta").join("0.pathc");
    let pathc_backup = backup_path.join("pathc_clean.bin");
    if pathc_backup.exists() {
        if fs::copy(&pathc_backup, &pathc_path).is_ok() {
            restored.push("Restored: PATHC".to_string());
        }
    }

    // 3. Delete entire 0036/ overlay directory
    let overlay_dir = game.join("0036");
    if overlay_dir.exists() {
        fs::remove_dir_all(&overlay_dir).ok();
        restored.push("Removed: 0036/ overlay directory".to_string());
    }

    // 4. Clean meta/ — remove anything that isn't vanilla
    let vanilla_meta = ["0.papgt", "0.pathc", "0.paver"];
    if let Ok(entries) = fs::read_dir(game.join("meta")) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !vanilla_meta.contains(&name.as_str()) {
                fs::remove_file(entry.path()).ok();
                restored.push(format!("Removed: meta/{}", name));
            }
        }
    }

    // 5. Nuclear bin64 cleanup — remove ALL non-vanilla files
    // Load vanilla manifest if available, otherwise use known vanilla file list
    let manifest_path = backup_path.join("vanilla_manifest.json");
    let vanilla_bin64: std::collections::HashSet<String> = if manifest_path.exists() {
        if let Ok(data) = fs::read_to_string(&manifest_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(bin64_obj) = v.get("bin64").and_then(|b| b.as_object()) {
                    bin64_obj.keys().cloned().collect()
                } else { std::collections::HashSet::new() }
            } else { std::collections::HashSet::new() }
        } else { std::collections::HashSet::new() }
    } else { std::collections::HashSet::new() };

    if !vanilla_bin64.is_empty() && bin64.exists() {
        if let Ok(entries) = fs::read_dir(&bin64) {
            // Staging dir for ASI mods we remove
            let asi_staging = backup_path.join("asi_staging");
            fs::create_dir_all(&asi_staging).ok();

            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !vanilla_bin64.contains(&name) {
                    let path = entry.path();
                    if path.is_file() {
                        // Move ASI/DLL/INI to staging instead of deleting
                        let lower = name.to_lowercase();
                        if lower.ends_with(".asi") || lower.ends_with(".asi.disabled")
                            || lower.ends_with(".ini") || lower.ends_with(".log")
                            || lower == "version.dll" || lower == "winmm.dll"
                            || lower == "dinput8.dll" || lower == "dsound.dll"
                        {
                            let dest = asi_staging.join(&name);
                            fs::rename(&path, &dest).or_else(|_| fs::copy(&path, &dest).map(|_| ())).ok();
                            fs::remove_file(&path).ok();
                            restored.push(format!("Moved to staging: bin64/{}", name));
                        } else {
                            fs::remove_file(&path).ok();
                            restored.push(format!("Removed: bin64/{}", name));
                        }
                    } else if path.is_dir() {
                        fs::remove_dir_all(&path).ok();
                        restored.push(format!("Removed: bin64/{}/", name));
                    }
                }
            }
        }
    }

    // 6. Remove stray files from game root
    if let Ok(entries) = fs::read_dir(game) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_file() {
                fs::remove_file(&path).ok();
                restored.push(format!("Removed: {}", name));
            } else if path.is_dir() {
                // Remove non-vanilla directories (not numbered groups, meta, bin64)
                let is_vanilla_dir = name == "bin64" || name == "meta"
                    || (name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()));
                if !is_vanilla_dir {
                    fs::remove_dir_all(&path).ok();
                    restored.push(format!("Removed: {}/", name));
                }
            }
        }
    }

    Ok(restored)
}

// === First-startup initialization ===

#[derive(Debug, Serialize, Deserialize)]
pub struct InitResult {
    pub success: bool,
    pub mods_dir_created: bool,
    pub backups_created: bool,
    pub messages: Vec<String>,
    pub program_files_warning: bool,
    pub papgt_modified: bool,
}

#[tauri::command]
pub fn get_app_dir() -> Result<String, String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;
    let dir = exe.parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_nexus_api_key() -> Result<String, String> {
    // Try loading from nexus_api_key.txt next to the exe
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let key_file = dir.join("nexus_api_key.txt");
            if key_file.exists() {
                if let Ok(key) = fs::read_to_string(&key_file) {
                    let key = key.trim().to_string();
                    if !key.is_empty() {
                        return Ok(key);
                    }
                }
            }
        }
    }
    Ok(String::new())
}

#[tauri::command]
pub fn initialize_app(game_path: String, app_dir: String) -> Result<InitResult, String> {
    let mut result = InitResult {
        success: true,
        mods_dir_created: false,
        backups_created: false,
        messages: Vec::new(),
        program_files_warning: false,
        papgt_modified: false,
    };

    let app_path = Path::new(&app_dir);
    let mods_dir = app_path.join("mods");
    let backup_dir = app_path.join("backups");

    // Warn if game is installed under Program Files (restricted write permissions)
    let game_lower = game_path.to_lowercase();
    if game_lower.contains("program files") {
        result.program_files_warning = true;
        result.messages.push("Game is installed under Program Files — this can cause write permission issues with modding. Consider moving your Steam library to a non-protected location like C:\\SteamLibrary.".to_string());
    }

    // Create mods directory
    if !mods_dir.exists() {
        fs::create_dir_all(&mods_dir)
            .map_err(|e| format!("Failed to create mods directory: {}", e))?;
        result.mods_dir_created = true;
        result.messages.push(format!("Created mods directory: {}", mods_dir.display()));
    }

    // Create backups directory
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backups directory: {}", e))?;
        result.messages.push(format!("Created backups directory: {}", backup_dir.display()));
    }

    // Validate game path
    let game = Path::new(&game_path);
    let exe = game.join("bin64").join("CrimsonDesert.exe");
    if !exe.exists() {
        result.messages.push("Game executable not found — skipping backup creation".to_string());
        return Ok(result);
    }

    // Helper: check if a PAPGT binary contains a "0036" overlay entry
    fn papgt_has_overlay(data: &[u8]) -> bool {
        if data.len() < 12 { return false; }
        let entry_count = data[8] as usize;
        let entries_end = 12 + entry_count * 12;
        if data.len() < entries_end + 4 { return false; }
        let names_len = u32::from_le_bytes(
            data[entries_end..entries_end + 4].try_into().unwrap_or([0; 4])
        ) as usize;
        let names_start = entries_end + 4;
        if data.len() < names_start + names_len { return false; }
        let names_block = &data[names_start..names_start + names_len];
        // Search for "0036\0" in the names block
        let needle = b"0036\0";
        names_block.windows(needle.len()).any(|w| w == needle)
    }

    // === Game version detection and cache invalidation ===
    // The PAPGT contains CRC hashes for every PAZ group's PAMT. When the game
    // updates, these hashes change. We use the PAPGT content as a version fingerprint.
    // If it changes, all cached pabgb extracts are stale and must be re-extracted.
    let papgt_path = game.join("meta").join("0.papgt");
    let papgt_clean = backup_dir.join("papgt_clean.bin");
    let version_file = backup_dir.join("game_version.bin");

    if papgt_path.exists() {
        let papgt_data = fs::read(&papgt_path)
            .map_err(|e| format!("Failed to read PAPGT: {}", e))?;

        // Check for tainted PAPGT (has overlay entry from another tool)
        if papgt_has_overlay(&papgt_data) {
            if !papgt_clean.exists() {
                // First run with a modded game
                result.papgt_modified = true;
                result.messages.push("PAPGT is not vanilla — it contains an overlay entry from another tool or previous mod session.".to_string());
            }
        } else {
            // PAPGT is vanilla — compute version fingerprint
            let current_hash = {
                let mut hasher = Sha256::new();
                hasher.update(&papgt_data);
                hasher.finalize().to_vec()
            };

            let version_changed = if version_file.exists() {
                if let Ok(stored_hash) = fs::read(&version_file) {
                    stored_hash != current_hash
                } else { true }
            } else { false }; // First run — no previous version to compare

            if version_changed {
                // Game updated! Invalidate all caches
                result.messages.push("Game update detected — invalidating cached data and updating backups".to_string());

                // Delete stale pabgb extracts
                if let Ok(entries) = fs::read_dir(&backup_dir) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.ends_with("_clean.bin") && name != "papgt_clean.bin" && name != "pathc_clean.bin" {
                            fs::remove_file(entry.path()).ok();
                        }
                    }
                }

                // Delete stale overlay references
                let overlay_pamt_ref = backup_dir.join("overlay_clean.pamt");
                let overlay_paz_ref = backup_dir.join("overlay_clean.paz");
                if overlay_pamt_ref.exists() { fs::remove_file(&overlay_pamt_ref).ok(); }
                if overlay_paz_ref.exists() { fs::remove_file(&overlay_paz_ref).ok(); }

                // Update PAPGT backup
                fs::write(&papgt_clean, &papgt_data)
                    .map_err(|e| format!("Failed to update PAPGT backup: {}", e))?;

                // Update PATHC backup
                let pathc_path = game.join("meta").join("0.pathc");
                let pathc_clean = backup_dir.join("pathc_clean.bin");
                if pathc_path.exists() {
                    fs::copy(&pathc_path, &pathc_clean)
                        .map_err(|e| format!("Failed to update PATHC backup: {}", e))?;
                }

                result.messages.push("Caches cleared, backups refreshed for new game version".to_string());
            } else if !papgt_clean.exists() {
                // First run — create initial backups
                fs::write(&papgt_clean, &papgt_data)
                    .map_err(|e| format!("Failed to backup PAPGT: {}", e))?;
                result.messages.push("Backed up clean PAPGT".to_string());
                result.backups_created = true;

                let pathc_path = game.join("meta").join("0.pathc");
                let pathc_clean = backup_dir.join("pathc_clean.bin");
                if !pathc_clean.exists() && pathc_path.exists() {
                    fs::copy(&pathc_path, &pathc_clean)
                        .map_err(|e| format!("Failed to backup PATHC: {}", e))?;
                    result.messages.push("Backed up clean PATHC".to_string());
                    result.backups_created = true;
                }
            } else {
                // Validate the existing backup is vanilla
                if let Ok(backup_data) = fs::read(&papgt_clean) {
                    if papgt_has_overlay(&backup_data) {
                        fs::remove_file(&papgt_clean).ok();
                        result.papgt_modified = true;
                        result.messages.push("Existing PAPGT backup was not vanilla — removed. Verify game files through Steam, then restart DMM.".to_string());
                    }
                }
            }

            // Always store the current version fingerprint
            fs::write(&version_file, &current_hash).ok();
        }
    }

    // Backup clean overlay PAMT (reference — never modified)
    let pamt_ref = backup_dir.join("overlay_clean.pamt");
    if !pamt_ref.exists() {
        let pamt_path = game.join("0036").join("0.pamt");
        if pamt_path.exists() {
            fs::copy(&pamt_path, &pamt_ref)
                .map_err(|e| format!("Failed to backup PAMT: {}", e))?;
            result.messages.push("Backed up overlay PAMT reference".to_string());
            result.backups_created = true;
        }
    }

    // Extract clean pabgb files from the overlay PAZ using PAMT parser
    let overlay_paz_path = game.join("0036").join("0.paz");
    let overlay_pamt_path = game.join("0036").join("0.pamt");

    if overlay_paz_path.exists() && overlay_pamt_path.exists() {
        let pamt_data = fs::read(&overlay_pamt_path)
            .map_err(|e| format!("Failed to read PAMT: {}", e))?;

        match read_pamt(&pamt_data) {
            Ok(pamt_info) => {
                let file_index = build_file_index(&pamt_info);
                let paz_data = fs::read(&overlay_paz_path)
                    .map_err(|e| format!("Failed to read overlay PAZ: {}", e))?;

                for (full_path, rec) in &file_index {
                    let bare_name = full_path.rsplit('/').next().unwrap_or(full_path);
                    let clean_name = bare_name.replace(".pabgb", "_clean.bin");
                    let clean_backup = backup_dir.join(&clean_name);

                    if clean_backup.exists() {
                        continue; // Already extracted
                    }

                    let offset = rec.paz_offset as usize;
                    let comp = rec.comp_size as usize;
                    let decomp = rec.decomp_size as usize;

                    if offset + comp > paz_data.len() {
                        result.messages.push(format!(
                            "Warning: {} extends past PAZ end (offset={}, comp={})",
                            bare_name, offset, comp
                        ));
                        continue;
                    }

                    if comp != decomp {
                        match lz4::block::decompress(&paz_data[offset..offset + comp], Some(decomp as i32)) {
                            Ok(flat_data) => {
                                let _ = fs::write(&clean_backup, &flat_data);
                                result.messages.push(format!(
                                    "Extracted clean {}: {} bytes",
                                    bare_name, flat_data.len()
                                ));
                                result.backups_created = true;
                            }
                            Err(e) => {
                                result.messages.push(format!(
                                    "Warning: Could not decompress {}: {}", bare_name, e
                                ));
                            }
                        }
                    } else {
                        // Uncompressed file
                        let raw = paz_data[offset..offset + comp].to_vec();
                        let _ = fs::write(&clean_backup, &raw);
                        result.messages.push(format!(
                            "Extracted clean {} (uncompressed): {} bytes",
                            bare_name, raw.len()
                        ));
                        result.backups_created = true;
                    }
                }
            }
            Err(e) => {
                result.messages.push(format!("Warning: Could not parse overlay PAMT: {}", e));
            }
        }
    } else {
        result.messages.push("Overlay 0036 not found — will be created on first mount".to_string());
    }

    result.messages.push("Initialization complete".to_string());
    Ok(result)
}

#[tauri::command]
pub fn import_mod(source_path: String, mods_path: String) -> Result<ModEntry, String> {
    let source = Path::new(&source_path);
    let dest = Path::new(&mods_path).join(source.file_name().unwrap());

    fs::copy(source, &dest)
        .map_err(|e| format!("Failed to import mod: {}", e))?;

    let mod_file = parse_mod_file(&dest)?;
    let (title, version, author, description) = get_mod_display_info(&mod_file);
    let patch_count: usize = mod_file.patches.iter().map(|p| p.changes.len()).sum();
    let game_files: Vec<String> = mod_file.patches.iter().map(|p| p.game_file.clone()).collect();

    Ok(ModEntry {
        file_name: dest.file_name().unwrap().to_string_lossy().to_string(),
        title,
        version,
        author,
        description,
        enabled: false,
        patch_count,
        game_files,
        has_conflicts: false,
    })
}

#[tauri::command]
pub fn delete_mod(mods_path: String, file_name: String) -> Result<(), String> {
    let mod_path = Path::new(&mods_path).join(&file_name);
    if !mod_path.exists() {
        return Err(format!("Mod file not found: {}", file_name));
    }
    fs::remove_file(&mod_path)
        .map_err(|e| format!("Failed to delete {}: {}", file_name, e))?;
    Ok(())
}

// --- Language mod support ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LangModEntry {
    pub file_name: String,
    pub title: String,
    pub language: String,
    pub author: String,
    pub description: String,
    pub active: bool,
}

#[tauri::command]
pub fn scan_lang_mods(mods_path: String, active_lang_mod: Option<String>) -> Result<Vec<LangModEntry>, String> {
    let lang_dir = Path::new(&mods_path).join("_lang");
    if !lang_dir.exists() {
        fs::create_dir_all(&lang_dir)
            .map_err(|e| format!("Failed to create _lang directory: {}", e))?;
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(&lang_dir)
        .map_err(|e| format!("Failed to read _lang directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let file_name = path.file_name().unwrap().to_string_lossy().to_string();

        match parse_mod_file(&path) {
            Ok(mod_file) => {
                let (title, _version, author, description) = get_mod_display_info(&mod_file);
                let language = title.to_lowercase();
                let active = active_lang_mod.as_deref() == Some(&file_name);

                entries.push(LangModEntry {
                    file_name,
                    title,
                    language,
                    author,
                    description,
                    active,
                });
            }
            Err(e) => {
                log::warn!("Skipping lang mod {}: {}", file_name, e);
            }
        }
    }

    Ok(entries)
}

// --- Archive import support ---

#[tauri::command]
pub fn import_archive(archive_path: String, mods_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&archive_path);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    match ext.as_str() {
        "zip" => import_zip(&archive_path, &mods_path),
        _ => Err(format!("Unsupported archive format: .{}", ext)),
    }
}

fn import_zip(archive_path: &str, mods_path: &str) -> Result<Vec<String>, String> {
    let file = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;

    let mods_dir = Path::new(mods_path);
    let mut imported = Vec::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        let name = file.name().to_string();

        if file.is_dir() {
            let dest = mods_dir.join(&name);
            fs::create_dir_all(&dest)
                .map_err(|e| format!("Failed to create dir {}: {}", name, e))?;
        } else {
            let dest = mods_dir.join(&name);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut content = Vec::new();
            file.read_to_end(&mut content)
                .map_err(|e| format!("Failed to extract {}: {}", name, e))?;
            fs::write(&dest, &content)
                .map_err(|e| format!("Failed to write {}: {}", name, e))?;
            imported.push(name);
        }
    }

    Ok(imported)
}

#[tauri::command]
pub fn import_folder(source_path: String, mods_path: String) -> Result<String, String> {
    let src = Path::new(&source_path);
    if !src.is_dir() {
        return Err("Source is not a directory".to_string());
    }
    let folder_name = src.file_name()
        .ok_or_else(|| "Invalid folder name".to_string())?
        .to_string_lossy().to_string();
    let dest = Path::new(&mods_path).join(&folder_name);

    fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
        fs::create_dir_all(dst).map_err(|e| format!("Failed to create dir: {}", e))?;
        for entry in fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
            let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if src_path.is_dir() {
                copy_dir(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
            }
        }
        Ok(())
    }

    copy_dir(src, &dest)?;
    Ok(folder_name)
}

#[tauri::command]
pub fn collect_asi_from_mods(mods_path: String, game_path: String) -> Result<Vec<String>, String> {
    let mods_dir = Path::new(&mods_path);
    let bin64 = Path::new(&game_path).join("bin64");
    if !mods_dir.exists() {
        return Ok(vec![]);
    }
    fs::create_dir_all(&bin64).map_err(|e| format!("Failed to create bin64: {}", e))?;

    let mut installed: Vec<String> = Vec::new();
    let entries = fs::read_dir(mods_dir).map_err(|e| format!("Failed to read mods dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let lower = name.to_lowercase();

        // Loose .asi/.dll files in the mods root
        if path.is_file() && (lower.ends_with(".asi") || (lower.ends_with(".dll") && !ASI_LOADER_NAMES.contains(&lower.as_str()))) {
            let dest = bin64.join(&name);
            fs::copy(&path, &dest).map_err(|e| format!("Failed to copy {}: {}", name, e))?;
            // Also copy companion .ini if present
            let stem = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let ini_name = format!("{}.ini", stem);
            let ini_src = mods_dir.join(&ini_name);
            if ini_src.exists() {
                fs::copy(&ini_src, bin64.join(&ini_name)).ok();
                fs::remove_file(&ini_src).ok();
            }
            fs::remove_file(&path).ok();
            installed.push(name);
            continue;
        }

        // Folders containing .asi files (e.g. "Storage Anywhere/PrivateStorageAnywhere.asi")
        if path.is_dir() {
            let mut has_asi = false;
            if let Ok(sub_entries) = fs::read_dir(&path) {
                for sub in sub_entries.flatten() {
                    let sub_name = sub.file_name().to_string_lossy().to_string();
                    let sub_lower = sub_name.to_lowercase();
                    if sub.path().is_file() && sub_lower.ends_with(".asi") {
                        has_asi = true;
                        break;
                    }
                }
            }
            if has_asi {
                // Install all .asi, .ini, and loader DLLs from this folder
                if let Ok(sub_entries) = fs::read_dir(&path) {
                    for sub in sub_entries.flatten() {
                        let sub_name = sub.file_name().to_string_lossy().to_string();
                        let sub_lower = sub_name.to_lowercase();
                        if sub.path().is_file() && (sub_lower.ends_with(".asi") || sub_lower.ends_with(".ini")) {
                            let dest = bin64.join(&sub_name);
                            fs::copy(sub.path(), &dest).map_err(|e| format!("Failed to copy {}: {}", sub_name, e))?;
                            installed.push(sub_name);
                        } else if sub.path().is_file() && sub_lower.ends_with(".dll") && !ASI_LOADER_NAMES.contains(&sub_lower.as_str()) {
                            let dest = bin64.join(&sub_name);
                            fs::copy(sub.path(), &dest).map_err(|e| format!("Failed to copy {}: {}", sub_name, e))?;
                            installed.push(sub_name);
                        }
                    }
                }
                // Remove the folder after installing
                fs::remove_dir_all(&path).ok();
            }
        }
    }

    Ok(installed)
}

#[tauri::command]
pub fn check_has_asi_files(source_path: String) -> bool {
    let path = Path::new(&source_path);
    if path.is_file() {
        let lower = source_path.to_lowercase();
        return lower.ends_with(".asi") || lower.ends_with(".dll");
    }
    if path.is_dir() {
        fn has_asi(dir: &Path) -> bool {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        if has_asi(&p) { return true; }
                    } else {
                        let name = entry.file_name().to_string_lossy().to_lowercase();
                        if name.ends_with(".asi") { return true; }
                    }
                }
            }
            false
        }
        return has_asi(path);
    }
    false
}

// --- Game detection and launch support ---

#[tauri::command]
pub fn auto_detect_game_path() -> Result<Option<String>, String> {
    let game_exe = Path::new("bin64").join("CrimsonDesert.exe");

    // === STEAM ===
    // Find Steam install roots
    let mut steam_roots: Vec<String> = Vec::new();
    for drive in &['C', 'D', 'E', 'F', 'G', 'H', 'I'] {
        for suffix in &[
            "\\Program Files (x86)\\Steam",
            "\\Program Files\\Steam",
            "\\Steam",
            "\\SteamLibrary",
            "\\Games\\Steam",
            "\\Games\\SteamLibrary",
        ] {
            let path = format!("{}:{}", drive, suffix);
            if Path::new(&path).exists() && !steam_roots.contains(&path) {
                steam_roots.push(path);
            }
        }
    }

    // Parse libraryfolders.vdf from each Steam root to find all library locations
    let mut library_dirs: Vec<String> = Vec::new();
    for steam_root in &steam_roots {
        let vdf_path = Path::new(steam_root).join("steamapps").join("libraryfolders.vdf");
        if let Ok(content) = fs::read_to_string(&vdf_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("\"path\"") {
                    if let Some(start) = trimmed.rfind('"') {
                        let before_last = &trimmed[..start];
                        if let Some(second) = before_last.rfind('"') {
                            let path = before_last[second + 1..].replace("\\\\", "\\");
                            if !library_dirs.contains(&path) {
                                library_dirs.push(path);
                            }
                        }
                    }
                }
            }
        }
        if !library_dirs.contains(steam_root) {
            library_dirs.push(steam_root.clone());
        }
    }

    // Check each Steam library for Crimson Desert
    for lib_dir in &library_dirs {
        let game_path = Path::new(lib_dir).join("steamapps").join("common").join("Crimson Desert");
        if game_path.join(&game_exe).exists() {
            return Ok(Some(game_path.to_string_lossy().to_string()));
        }
    }

    // === XBOX GAME PASS / MICROSOFT STORE ===
    let xbox_game_names = ["Crimson Desert", "PearlAbyss.CrimsonDesert", "CrimsonDesert"];

    for drive in &['C', 'D', 'E', 'F', 'G', 'H', 'I'] {
        for name in &xbox_game_names {
            // XboxGames folder (most common for Game Pass)
            for sub in &["Content", ""] {
                let mut xbox_path = format!("{}:\\XboxGames\\{}", drive, name);
                if !sub.is_empty() {
                    xbox_path = format!("{}\\{}", xbox_path, sub);
                }
                if Path::new(&xbox_path).join(&game_exe).exists() {
                    return Ok(Some(xbox_path));
                }
            }
        }
    }

    // ModifiableWindowsApps (accessible Game Pass location)
    for base in &[
        "C:\\Program Files\\ModifiableWindowsApps",
        "C:\\Program Files (x86)\\ModifiableWindowsApps",
    ] {
        let base_path = Path::new(base);
        if base_path.exists() {
            if let Ok(entries) = fs::read_dir(base_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if xbox_game_names.iter().any(|n| name.contains(&n.to_lowercase())) {
                        let path = entry.path();
                        if path.join(&game_exe).exists() {
                            return Ok(Some(path.to_string_lossy().to_string()));
                        }
                    }
                }
            }
        }
    }

    // === EPIC GAMES STORE ===
    for drive in &['C', 'D', 'E', 'F', 'G', 'H', 'I'] {
        for suffix in &[
            "\\Program Files\\Epic Games\\CrimsonDesert",
            "\\Program Files\\Epic Games\\Crimson Desert",
            "\\Epic Games\\CrimsonDesert",
            "\\Epic Games\\Crimson Desert",
            "\\Games\\Epic\\CrimsonDesert",
            "\\Games\\Epic\\Crimson Desert",
        ] {
            let path = format!("{}:{}", drive, suffix);
            if Path::new(&path).join(&game_exe).exists() {
                return Ok(Some(path));
            }
        }
    }

    // Also check Epic's manifests for custom install locations
    let epic_manifests = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
    if epic_manifests.exists() {
        if let Ok(entries) = fs::read_dir(epic_manifests) {
            for entry in entries.flatten() {
                if entry.path().extension().and_then(|e| e.to_str()) == Some("item") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if content.to_lowercase().contains("crimson") || content.to_lowercase().contains("desert") {
                            // Parse InstallLocation from the manifest
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                                if let Some(loc) = v.get("InstallLocation").and_then(|l| l.as_str()) {
                                    let path = Path::new(loc);
                                    if path.join(&game_exe).exists() {
                                        return Ok(Some(path.to_string_lossy().to_string()));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn launch_game(game_path: String) -> Result<(), String> {
    let exe = Path::new(&game_path).join("bin64").join("CrimsonDesert.exe");

    if !exe.exists() {
        return Err(format!("Game executable not found: {}", exe.display()));
    }

    Command::new(&exe)
        .current_dir(&game_path)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn open_folder(folder_path: String) -> Result<(), String> {
    let path = Path::new(&folder_path);
    if !path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }

    Command::new("explorer")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}

// --- PAPGT status support ---

#[derive(Debug, Serialize, Deserialize)]
pub struct PapgtStatus {
    pub exists: bool,
    pub has_overlay: bool,
    pub overlay_groups: Vec<String>,
    pub total_groups: usize,
}

#[tauri::command]
pub fn get_papgt_status(game_path: String) -> Result<PapgtStatus, String> {
    let papgt_path = Path::new(&game_path).join("meta").join("0.papgt");

    if !papgt_path.exists() {
        return Ok(PapgtStatus {
            exists: false,
            has_overlay: false,
            overlay_groups: Vec::new(),
            total_groups: 0,
        });
    }

    let data = fs::read(&papgt_path)
        .map_err(|e| format!("Failed to read 0.papgt: {}", e))?;

    if data.len() < 12 {
        return Ok(PapgtStatus {
            exists: true,
            has_overlay: false,
            overlay_groups: Vec::new(),
            total_groups: 0,
        });
    }

    // Parse PAPGT structure properly
    let entry_count = data[8] as usize;
    let entries_start = 12;
    let entries_end = entries_start + entry_count * 12;

    if data.len() < entries_end + 4 {
        return Ok(PapgtStatus {
            exists: true,
            has_overlay: false,
            overlay_groups: Vec::new(),
            total_groups: entry_count,
        });
    }

    // Read the names block
    let names_block_len = u32::from_le_bytes(
        data[entries_end..entries_end + 4].try_into().unwrap(),
    ) as usize;
    let names_start = entries_end + 4;
    let names_end = names_start + names_block_len;

    if data.len() < names_end {
        return Ok(PapgtStatus {
            exists: true,
            has_overlay: false,
            overlay_groups: Vec::new(),
            total_groups: entry_count,
        });
    }

    let names_block = &data[names_start..names_end];

    // Extract folder names from entries using their name offsets
    let mut groups: Vec<String> = Vec::new();
    for i in 0..entry_count {
        let base = entries_start + i * 12;
        let name_offset = u32::from_le_bytes(data[base + 4..base + 8].try_into().unwrap()) as usize;

        if name_offset < names_block.len() {
            let name_end = names_block[name_offset..]
                .iter()
                .position(|&b| b == 0)
                .unwrap_or(names_block.len() - name_offset);
            if let Ok(name) = std::str::from_utf8(&names_block[name_offset..name_offset + name_end]) {
                if !name.is_empty() {
                    groups.push(name.to_string());
                }
            }
        }
    }

    let total_groups = groups.len();

    // The 0036 overlay is the custom overlay folder
    let overlay_groups: Vec<String> = groups
        .iter()
        .filter(|g| *g == "0036")
        .cloned()
        .collect();

    let has_overlay = !overlay_groups.is_empty();

    Ok(PapgtStatus {
        exists: true,
        has_overlay,
        overlay_groups,
        total_groups,
    })
}

// =============================================================================
// 1. Mod Profiles
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModProfile {
    pub name: String,
    pub created: String,
    #[serde(rename = "activeMods")]
    pub active_mods: Vec<ActiveMod>,
    #[serde(rename = "activeLangMod")]
    pub active_lang_mod: Option<String>,
    #[serde(rename = "selectedLanguage")]
    pub selected_language: String,
}

#[tauri::command]
pub fn save_profile(
    profile_name: String,
    config: AppConfig,
    profiles_dir: String,
) -> Result<(), String> {
    let dir = Path::new(&profiles_dir);
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create profiles directory: {}", e))?;
    }

    let profile = ModProfile {
        name: profile_name.clone(),
        created: chrono::Local::now().to_rfc3339(),
        active_mods: config.active_mods,
        active_lang_mod: config.active_lang_mod,
        selected_language: config.selected_language,
    };

    let file_name = format!("{}.json", sanitize_filename(&profile_name));
    let path = dir.join(&file_name);

    let content = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("Failed to serialize profile: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write profile: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn load_profile(
    profile_name: String,
    profiles_dir: String,
) -> Result<ModProfile, String> {
    let file_name = format!("{}.json", sanitize_filename(&profile_name));
    let path = Path::new(&profiles_dir).join(&file_name);

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read profile '{}': {}", profile_name, e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse profile '{}': {}", profile_name, e))
}

#[tauri::command]
pub fn list_profiles(profiles_dir: String) -> Result<Vec<ModProfile>, String> {
    let dir = Path::new(&profiles_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read profiles directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        match fs::read_to_string(&path) {
            Ok(content) => {
                if let Ok(profile) = serde_json::from_str::<ModProfile>(&content) {
                    profiles.push(profile);
                }
            }
            Err(e) => {
                log::warn!("Skipping profile {}: {}", path.display(), e);
            }
        }
    }

    profiles.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(profiles)
}

#[tauri::command]
pub fn delete_profile(
    profile_name: String,
    profiles_dir: String,
) -> Result<(), String> {
    let file_name = format!("{}.json", sanitize_filename(&profile_name));
    let path = Path::new(&profiles_dir).join(&file_name);

    if !path.exists() {
        return Err(format!("Profile '{}' not found", profile_name));
    }

    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete profile '{}': {}", profile_name, e))
}

/// Sanitize a profile name into a safe filename (no path separators or special chars).
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

// =============================================================================
// 2. Game Version Tracking
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct GameVersion {
    pub paver_hex: String,
    pub exe_size: u64,
    pub exe_modified: String,
}

#[tauri::command]
pub fn get_game_version(game_path: String) -> Result<GameVersion, String> {
    let paver_path = Path::new(&game_path).join("meta").join("0.paver");
    let exe_path = Path::new(&game_path).join("bin64").join("CrimsonDesert.exe");

    // Read paver as raw bytes and convert to hex
    let paver_bytes = fs::read(&paver_path)
        .map_err(|e| format!("Failed to read 0.paver: {}", e))?;
    let paver_hex = hex::encode(&paver_bytes);

    // Get exe metadata
    let exe_meta = fs::metadata(&exe_path)
        .map_err(|e| format!("Failed to read CrimsonDesert.exe metadata: {}", e))?;
    let exe_size = exe_meta.len();

    let exe_modified = match exe_meta.modified() {
        Ok(time) => {
            let datetime: chrono::DateTime<chrono::Local> = time.into();
            datetime.to_rfc3339()
        }
        Err(_) => "unknown".to_string(),
    };

    Ok(GameVersion {
        paver_hex,
        exe_size,
        exe_modified,
    })
}

#[tauri::command]
pub fn check_version_changed(
    game_path: String,
    stored_version: String,
) -> Result<bool, String> {
    let current = get_game_version(game_path)?;
    Ok(current.paver_hex != stored_version)
}

// =============================================================================
// 3. Read Mod Readme
// =============================================================================

#[tauri::command]
pub fn read_mod_readme(
    mods_path: String,
    mod_file_name: String,
) -> Result<Option<String>, String> {
    let mods_dir = Path::new(&mods_path);

    // Strip .json extension to get the base mod name
    let base_name = mod_file_name.trim_end_matches(".json");

    // Extract a prefix to match against folder names (first few words)
    let prefix = base_name
        .split(|c: char| !c.is_alphanumeric())
        .next()
        .unwrap_or(base_name);

    let entries = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Check if this folder name starts with the same prefix as the mod
        // or matches the base name pattern
        let folder_matches = folder_name.starts_with(prefix)
            || base_name
                .split_whitespace()
                .take(2)
                .all(|word| folder_name.contains(word));

        if folder_matches {
            let readme_path = path.join("readme.txt");
            if readme_path.exists() {
                let content = fs::read_to_string(&readme_path)
                    .map_err(|e| format!("Failed to read readme: {}", e))?;
                return Ok(Some(content));
            }
        }
    }

    Ok(None)
}

// =============================================================================
// 4. Nexus Folder Import
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct NexusFolder {
    pub folder_name: String,
    pub mod_name: String,
    pub has_json: bool,
    pub has_readme: bool,
}

#[tauri::command]
pub fn scan_nexus_folders(mods_path: String) -> Result<Vec<NexusFolder>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    let mut folders = Vec::new();
    let entries = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Match Nexus format: ModName-123-1-timestamp
        // Pattern: contains at least one hyphen followed by digits
        if !is_nexus_folder_name(&folder_name) {
            continue;
        }

        // Extract the mod name (everything before the first hyphen-digit sequence)
        let mod_name = extract_nexus_mod_name(&folder_name);

        // Check for JSON files (excluding modinfo.json)
        let has_json = fs::read_dir(&path)
            .map(|entries| {
                entries.filter_map(|e| e.ok()).any(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    name.ends_with(".json") && name.to_lowercase() != "modinfo.json"
                })
            })
            .unwrap_or(false);

        let has_readme = path.join("readme.txt").exists()
            || path.join("README.txt").exists()
            || path.join("Readme.txt").exists();

        folders.push(NexusFolder {
            folder_name,
            mod_name,
            has_json,
            has_readme,
        });
    }

    folders.sort_by(|a, b| a.mod_name.to_lowercase().cmp(&b.mod_name.to_lowercase()));
    Ok(folders)
}

/// Check if a folder name matches the Nexus Mods naming pattern.
/// Pattern: SomeName-<digits>-<digits>-<timestamp>
fn is_nexus_folder_name(name: &str) -> bool {
    let parts: Vec<&str> = name.split('-').collect();
    if parts.len() < 3 {
        return false;
    }
    // At least one part after the first must be purely numeric
    parts[1..].iter().any(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

/// Extract the human-readable mod name from a Nexus folder name.
/// e.g., "Cool Mod Name-123-1-1234567890" -> "Cool Mod Name"
fn extract_nexus_mod_name(folder_name: &str) -> String {
    let parts: Vec<&str> = folder_name.split('-').collect();
    // Find the first part that is purely numeric -- everything before it is the name
    let mut name_parts = Vec::new();
    for part in &parts {
        if !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()) {
            break;
        }
        name_parts.push(*part);
    }
    if name_parts.is_empty() {
        folder_name.to_string()
    } else {
        name_parts.join("-")
    }
}

#[tauri::command]
pub fn import_nexus_folder(
    mods_path: String,
    folder_name: String,
) -> Result<Vec<String>, String> {
    let mods_dir = Path::new(&mods_path);
    let folder_path = mods_dir.join(&folder_name);

    if !folder_path.exists() || !folder_path.is_dir() {
        return Err(format!("Nexus folder not found: {}", folder_name));
    }

    let mut imported = Vec::new();
    let entries = fs::read_dir(&folder_path)
        .map_err(|e| format!("Failed to read Nexus folder: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = entry.file_name().to_string_lossy().to_string();

        // Copy .json files (excluding modinfo.json) to mods root
        if file_name.ends_with(".json") && file_name.to_lowercase() != "modinfo.json" {
            let source = entry.path();
            let dest = mods_dir.join(&file_name);

            fs::copy(&source, &dest)
                .map_err(|e| format!("Failed to copy {}: {}", file_name, e))?;
            imported.push(file_name);
        }
    }

    Ok(imported)
}

// =============================================================================
// 5. Export/Import Mod List
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedModList {
    pub format_version: u32,
    #[serde(rename = "activeMods")]
    pub active_mods: Vec<ActiveMod>,
    #[serde(rename = "activeLangMod")]
    pub active_lang_mod: Option<String>,
    #[serde(rename = "selectedLanguage")]
    pub selected_language: String,
    #[serde(rename = "modHashes")]
    pub mod_hashes: HashMap<String, String>,
    pub exported_at: String,
}

#[tauri::command]
pub fn export_mod_list(
    config: AppConfig,
    export_path: String,
) -> Result<(), String> {
    // Compute SHA-256 hashes for each active mod file
    let mut mod_hashes = HashMap::new();
    let mods_dir = Path::new(&config.mods_path);

    for active_mod in &config.active_mods {
        let mod_path = mods_dir.join(&active_mod.file_name);
        if mod_path.exists() {
            match fs::read(&mod_path) {
                Ok(data) => {
                    let mut hasher = Sha256::new();
                    hasher.update(&data);
                    let hash = format!("{:x}", hasher.finalize());
                    mod_hashes.insert(active_mod.file_name.clone(), hash);
                }
                Err(e) => {
                    log::warn!("Could not hash {}: {}", active_mod.file_name, e);
                }
            }
        }
    }

    let export = ExportedModList {
        format_version: 1,
        active_mods: config.active_mods,
        active_lang_mod: config.active_lang_mod,
        selected_language: config.selected_language,
        mod_hashes,
        exported_at: chrono::Local::now().to_rfc3339(),
    };

    let content = serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Failed to serialize mod list: {}", e))?;
    fs::write(&export_path, content)
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn import_mod_list(import_path: String) -> Result<ExportedModList, String> {
    let content = fs::read_to_string(&import_path)
        .map_err(|e| format!("Failed to read mod list file: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse mod list file: {}", e))
}

// =============================================================================
// 6. Backup Manager
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub file_name: String,
    pub game_file: String,
    pub size: u64,
    pub created: String,
}

#[tauri::command]
pub fn list_backups(backup_dir: String) -> Result<Vec<BackupInfo>, String> {
    let dir = Path::new(&backup_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read backup directory: {}", e))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();

        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) if n.ends_with(".original") => n.to_string(),
            _ => continue,
        };

        // Skip internal DMM files that aren't user-facing backups
        let lower = name.to_lowercase();
        if lower.contains("papgt_clean") || lower.contains("pathc_clean")
            || lower.contains("overlay_clean") || lower.contains("_clean.bin")
            || lower.contains("ref_multi") {
            continue;
        }

        let game_file = name
            .trim_end_matches(".original")
            .replace('_', "/");

        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let created = match meta.modified() {
            Ok(time) => {
                let datetime: chrono::DateTime<chrono::Local> = time.into();
                datetime.to_rfc3339()
            }
            Err(_) => "unknown".to_string(),
        };

        backups.push(BackupInfo {
            file_name: name,
            game_file,
            size: meta.len(),
            created,
        });
    }

    backups.sort_by(|a, b| a.game_file.cmp(&b.game_file));
    Ok(backups)
}

#[tauri::command]
pub fn delete_backup(
    backup_dir: String,
    file_name: String,
) -> Result<(), String> {
    let path = Path::new(&backup_dir).join(&file_name);

    if !path.exists() {
        return Err(format!("Backup file not found: {}", file_name));
    }

    // Safety: ensure the file is actually inside the backup directory
    let canonical_dir = fs::canonicalize(&backup_dir)
        .map_err(|e| format!("Invalid backup directory: {}", e))?;
    let canonical_file = fs::canonicalize(&path)
        .map_err(|e| format!("Invalid backup file path: {}", e))?;

    if !canonical_file.starts_with(&canonical_dir) {
        return Err("Path traversal detected".to_string());
    }

    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete backup: {}", e))
}

#[tauri::command]
pub fn restore_single_backup(
    game_path: String,
    backup_dir: String,
    file_name: String,
) -> Result<(), String> {
    let backup_file = Path::new(&backup_dir).join(&file_name);

    if !backup_file.exists() {
        return Err(format!("Backup file not found: {}", file_name));
    }

    // Derive the game file path from the backup file name
    let game_file = file_name
        .trim_end_matches(".original")
        .replace('_', "/");

    let target = Path::new(&game_path).join(&game_file);

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            return Err(format!(
                "Game directory does not exist: {}",
                parent.display()
            ));
        }
    }

    fs::copy(&backup_file, &target)
        .map_err(|e| format!("Failed to restore {}: {}", game_file, e))?;

    Ok(())
}

// =============================================================================
// 7. Pre-flight Check
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct PreflightResult {
    pub passed: bool,
    pub checks: Vec<PreflightCheck>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreflightCheck {
    pub name: String,
    pub passed: bool,
    pub message: String,
}

#[tauri::command]
pub fn preflight_check(
    game_path: String,
    mods_path: String,
    active_mods: Vec<ActiveMod>,
) -> Result<PreflightResult, String> {
    let mut checks: Vec<PreflightCheck> = Vec::new();

    // 1. Check game path and executable
    let exe_path = Path::new(&game_path).join("bin64").join("CrimsonDesert.exe");
    let exe_exists = exe_path.exists();
    checks.push(PreflightCheck {
        name: "Game executable".to_string(),
        passed: exe_exists,
        message: if exe_exists {
            "bin64/CrimsonDesert.exe found".to_string()
        } else {
            format!("bin64/CrimsonDesert.exe not found at {}", game_path)
        },
    });

    // 2. Check each mod's target game files exist
    let mods_dir = Path::new(&mods_path);
    let mut all_game_files_ok = true;
    let mut missing_files: Vec<String> = Vec::new();

    // Also collect data for conflict and bounds checking
    let mut offset_map: HashMap<(String, u64), Vec<String>> = HashMap::new();
    let mut bounds_errors: Vec<String> = Vec::new();

    for active_mod in &active_mods {
        let mod_path = mods_dir.join(&active_mod.file_name);
        match parse_mod_file(&mod_path) {
            Ok(mod_file) => {
                let (title, _, _, _) = get_mod_display_info(&mod_file);

                for patch in &mod_file.patches {
                    // game_file paths like "gamedata/storeinfo.pabgb" are virtual
                    // references into PAZ archives, not literal files on disk.
                    // Skip file existence and bounds checks for these — they'll be
                    // resolved through the PAZ overlay system during mount.
                    let game_file_path = Path::new(&game_path).join(&patch.game_file);
                    let is_virtual = patch.game_file.starts_with("gamedata/")
                        || patch.game_file.ends_with(".pabgb");

                    if !is_virtual && !game_file_path.exists() {
                        all_game_files_ok = false;
                        let msg = format!("{} (needed by {})", patch.game_file, title);
                        if !missing_files.contains(&msg) {
                            missing_files.push(msg);
                        }
                        continue;
                    }

                    if is_virtual {
                        // Skip bounds checking for virtual PAZ paths
                        // Collect conflict data but don't check file existence
                        for (idx, change) in patch.changes.iter().enumerate() {
                            if !active_mod.disabled_indices.contains(&idx) {
                                let key = (patch.game_file.clone(), change.offset);
                                offset_map.entry(key).or_default().push(title.clone());
                            }
                        }
                        continue;
                    }

                    // 3. Bounds checking (only for real files)
                    let file_size = match fs::metadata(&game_file_path) {
                        Ok(m) => m.len(),
                        Err(_) => continue,
                    };

                    for (idx, change) in patch.changes.iter().enumerate() {
                        if active_mod.disabled_indices.contains(&idx) {
                            continue;
                        }

                        let patched_len = change.patched.len() / 2; // hex string -> byte count
                        if change.offset + patched_len as u64 > file_size {
                            bounds_errors.push(format!(
                                "{}: offset {} + {} bytes exceeds {} size ({} bytes)",
                                title,
                                change.offset,
                                patched_len,
                                patch.game_file,
                                file_size
                            ));
                        }

                        // Collect for conflict check
                        let key = (patch.game_file.clone(), change.offset);
                        offset_map
                            .entry(key)
                            .or_default()
                            .push(title.clone());
                    }
                }
            }
            Err(e) => {
                checks.push(PreflightCheck {
                    name: format!("Parse mod: {}", active_mod.file_name),
                    passed: false,
                    message: format!("Failed to parse: {}", e),
                });
            }
        }
    }

    // Game files check result
    checks.push(PreflightCheck {
        name: "Game files exist".to_string(),
        passed: all_game_files_ok,
        message: if all_game_files_ok {
            "All target game files found".to_string()
        } else {
            format!("Missing: {}", missing_files.join(", "))
        },
    });

    // 3. Bounds check result
    let bounds_ok = bounds_errors.is_empty();
    checks.push(PreflightCheck {
        name: "Offset bounds".to_string(),
        passed: bounds_ok,
        message: if bounds_ok {
            "All offsets are within file bounds".to_string()
        } else {
            format!("{} out-of-bounds: {}", bounds_errors.len(), bounds_errors.join("; "))
        },
    });

    // 4. Conflict check
    let conflicts: Vec<String> = offset_map
        .iter()
        .filter(|(_, mods)| mods.len() > 1)
        .map(|((file, offset), mods)| {
            let unique_mods: Vec<String> = {
                let mut seen = Vec::new();
                for m in mods {
                    if !seen.contains(m) {
                        seen.push(m.clone());
                    }
                }
                seen
            };
            format!(
                "{} @ offset {}: {}",
                file,
                offset,
                unique_mods.join(" vs ")
            )
        })
        .collect();

    let no_conflicts = conflicts.is_empty();
    checks.push(PreflightCheck {
        name: "Mod conflicts".to_string(),
        passed: no_conflicts,
        message: if no_conflicts {
            "No conflicting offsets detected".to_string()
        } else {
            format!("{} conflict(s): {}", conflicts.len(), conflicts.join("; "))
        },
    });

    // 5. Backup directory writable
    let backup_dir = Path::new(&game_path)
        .parent()
        .unwrap_or_else(|| Path::new(&game_path))
        .join("mod_backups");
    // Try the standard backup location next to the mods path
    let backup_dir_alt = Path::new(&mods_path).join("..").join("backups");
    let backup_writable = test_dir_writable(&backup_dir)
        || test_dir_writable(&backup_dir_alt);

    checks.push(PreflightCheck {
        name: "Backup directory".to_string(),
        passed: backup_writable,
        message: if backup_writable {
            "Backup directory is writable".to_string()
        } else {
            "Cannot write to backup directory".to_string()
        },
    });

    let passed = checks.iter().all(|c| c.passed);

    Ok(PreflightResult { passed, checks })
}

/// Test whether a directory exists (or can be created) and is writable.
fn test_dir_writable(dir: &Path) -> bool {
    if !dir.exists() {
        if fs::create_dir_all(dir).is_err() {
            return false;
        }
    }

    let test_file = dir.join(".write_test");
    match fs::write(&test_file, b"test") {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            true
        }
        Err(_) => false,
    }
}

// =============================================================================
// 8. Recover Interrupted Apply
// =============================================================================

/// Internal struct representing the state.json written during apply operations.
#[derive(Debug, Serialize, Deserialize)]
struct ApplyState {
    applied_mods: Vec<String>,
    game_version_id: Option<String>,
    timestamp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoverResult {
    pub was_interrupted: bool,
    pub files_restored: Vec<String>,
    pub errors: Vec<String>,
    pub message: String,
}

#[tauri::command]
pub fn recover_interrupted(
    game_path: String,
    backup_dir: String,
) -> Result<RecoverResult, String> {
    let backup_path = Path::new(&backup_dir);
    let state_path = backup_path.join("state.json");

    // Check if state.json exists — indicates a previous apply was in progress
    let has_state = state_path.exists();

    // Check if any .original backup files exist
    let has_backups = if backup_path.exists() {
        fs::read_dir(backup_path)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .any(|e| {
                        e.file_name()
                            .to_string_lossy()
                            .ends_with(".original")
                    })
            })
            .unwrap_or(false)
    } else {
        false
    };

    if !has_state && !has_backups {
        return Ok(RecoverResult {
            was_interrupted: false,
            files_restored: Vec::new(),
            errors: Vec::new(),
            message: "No interrupted operation detected".to_string(),
        });
    }

    let mut files_restored = Vec::new();
    let mut errors = Vec::new();

    // Restore all .original backup files to their game file locations
    if backup_path.exists() {
        let entries = fs::read_dir(backup_path)
            .map_err(|e| format!("Failed to read backup dir: {}", e))?;

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    errors.push(format!("Entry error: {}", e));
                    continue;
                }
            };

            let path = entry.path();
            let name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) if n.ends_with(".original") => n.to_string(),
                _ => continue,
            };

            let game_file = name
                .trim_end_matches(".original")
                .replace('_', "/");

            let target = Path::new(&game_path).join(&game_file);

            match fs::copy(&path, &target) {
                Ok(_) => {
                    files_restored.push(game_file);
                }
                Err(e) => {
                    errors.push(format!("Failed to restore {}: {}", game_file, e));
                }
            }
        }
    }

    // Delete state.json after recovery
    if state_path.exists() {
        if let Err(e) = fs::remove_file(&state_path) {
            errors.push(format!("Failed to delete state.json: {}", e));
        }
    }

    let message = if files_restored.is_empty() && errors.is_empty() {
        "State file found but no backup files to restore".to_string()
    } else if errors.is_empty() {
        format!("Recovered {} file(s) successfully", files_restored.len())
    } else {
        format!(
            "Recovered {} file(s) with {} error(s)",
            files_restored.len(),
            errors.len()
        )
    };

    Ok(RecoverResult {
        was_interrupted: has_state,
        files_restored,
        errors,
        message,
    })
}

// =============================================================================
// 9. Detailed Check (Pre-mount Diagnostic)
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedCheckResult {
    pub timestamp: String,
    pub game_dir_ok: bool,
    pub interrupted_apply: bool,
    pub version_mismatch: bool,
    pub current_version: String,
    pub saved_version: String,
    pub conflicts: Vec<ConflictInfo>,
    pub can_apply: bool,
    pub stale_backup: bool,
    pub mod_file_issues: Vec<String>,
    pub total_patches: usize,
    pub target_files: Vec<String>,
}

#[tauri::command]
pub fn detailed_check(
    game_path: String,
    mods_path: String,
    active_mods: Vec<ActiveMod>,
    backup_dir: String,
) -> Result<DetailedCheckResult, String> {
    let game_dir = Path::new(&game_path);
    let backup_path = Path::new(&backup_dir);
    let mods_dir = Path::new(&mods_path);

    // 1. Check game dir exists with bin64/CrimsonDesert.exe
    let exe_path = game_dir.join("bin64").join("CrimsonDesert.exe");
    let game_dir_ok = game_dir.exists() && exe_path.exists();

    // 2. Check for interrupted apply (state.json exists with applied_mods)
    let state_path = backup_path.join("state.json");
    let interrupted_apply = if state_path.exists() {
        match fs::read_to_string(&state_path) {
            Ok(content) => {
                serde_json::from_str::<ApplyState>(&content)
                    .map(|s| !s.applied_mods.is_empty())
                    .unwrap_or(false)
            }
            Err(_) => false,
        }
    } else {
        false
    };

    // 3. Read 0.paver as hex for current version; read state.json for saved game_version_id
    let paver_path = game_dir.join("meta").join("0.paver");
    let current_version = if paver_path.exists() {
        fs::read(&paver_path)
            .map(|bytes| hex::encode(&bytes))
            .unwrap_or_else(|_| "unreadable".to_string())
    } else {
        "not found".to_string()
    };

    let saved_version = if state_path.exists() {
        match fs::read_to_string(&state_path) {
            Ok(content) => {
                serde_json::from_str::<ApplyState>(&content)
                    .ok()
                    .and_then(|s| s.game_version_id)
                    .unwrap_or_else(|| "none".to_string())
            }
            Err(_) => "none".to_string(),
        }
    } else {
        "none".to_string()
    };

    let version_mismatch = saved_version != "none"
        && current_version != "not found"
        && current_version != "unreadable"
        && current_version != saved_version;

    // 4. Check if backup 0.papgt.original exists and compare size to current meta/0.papgt
    let papgt_backup = backup_path.join("meta_0.papgt.original");
    let papgt_current = game_dir.join("meta").join("0.papgt");
    let stale_backup = if papgt_backup.exists() && papgt_current.exists() {
        let backup_size = fs::metadata(&papgt_backup).map(|m| m.len()).unwrap_or(0);
        let current_size = fs::metadata(&papgt_current).map(|m| m.len()).unwrap_or(0);
        backup_size != current_size
    } else {
        false
    };

    // 5. Check all active mod JSON files exist and are parseable
    let mut mod_file_issues = Vec::new();
    let mut total_patches: usize = 0;
    let mut target_files_set: Vec<String> = Vec::new();

    // For conflict detection — reuse check_conflicts logic
    let mut offset_map: HashMap<(String, u64), Vec<(String, String)>> = HashMap::new();

    for active_mod in &active_mods {
        let mod_path = mods_dir.join(&active_mod.file_name);

        if !mod_path.exists() {
            mod_file_issues.push(format!("{}: file not found", active_mod.file_name));
            continue;
        }

        match parse_mod_file(&mod_path) {
            Ok(mod_file) => {
                let (title, _, _, _) = get_mod_display_info(&mod_file);

                for patch in &mod_file.patches {
                    // 6. Count total patches
                    total_patches += patch.changes.len();

                    // 7. Collect unique target game files
                    if !target_files_set.contains(&patch.game_file) {
                        target_files_set.push(patch.game_file.clone());
                    }

                    // 8. Collect for conflict detection
                    for change in &patch.changes {
                        let key = (patch.game_file.clone(), change.offset);
                        offset_map
                            .entry(key)
                            .or_default()
                            .push((title.clone(), change.label.clone()));
                    }
                }
            }
            Err(e) => {
                mod_file_issues.push(format!("{}: {}", active_mod.file_name, e));
            }
        }
    }

    // Build conflict list
    let conflicts: Vec<ConflictInfo> = offset_map
        .into_iter()
        .filter(|(_, mods)| mods.len() > 1)
        .map(|((game_file, offset), mods)| ConflictInfo {
            offset,
            game_file,
            mods: mods.iter().map(|(name, _)| name.clone()).collect(),
            labels: mods.iter().map(|(_, label)| label.clone()).collect(),
        })
        .collect();

    // 9. can_apply = game_dir_ok && mod_file_issues.is_empty()
    let can_apply = game_dir_ok && mod_file_issues.is_empty();

    target_files_set.sort();

    Ok(DetailedCheckResult {
        timestamp: chrono::Local::now().to_rfc3339(),
        game_dir_ok,
        interrupted_apply,
        version_mismatch,
        current_version,
        saved_version,
        conflicts,
        can_apply,
        stale_backup,
        mod_file_issues,
        total_patches,
        target_files: target_files_set,
    })
}

// =============================================================================
// Nexus Mods API Integration
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NexusIdMapping {
    pub file_name: String,
    pub nexus_mod_id: u64,
    pub folder_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModUpdateStatus {
    pub file_name: String,
    pub nexus_mod_id: Option<u64>,
    pub local_version: String,
    pub nexus_version: Option<String>,
    pub is_outdated: bool,
    pub nexus_url: Option<String>,
    pub error: Option<String>,
}

/// Scan the mods directory for Nexus-style folder names (Name-{modId}-{fileVersion}-{timestamp})
/// and match them to mod JSON files by comparing folder name prefixes.
#[tauri::command]
pub fn parse_nexus_mod_ids(mods_path: String) -> Result<Vec<NexusIdMapping>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    let mut mappings: Vec<NexusIdMapping> = Vec::new();

    // Collect all JSON mod files in the mods directory
    let json_files: Vec<String> = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.path().extension()
                .map(|ext| ext.to_string_lossy().to_lowercase() == "json")
                .unwrap_or(false)
        })
        .filter_map(|entry| entry.file_name().to_str().map(String::from))
        .collect();

    // Scan for Nexus-style subdirectories
    let entries = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Match pattern: Name-{digits}-{digits}-{digits}
        // The mod ID is the second group from the end (second-to-last number)
        let parts: Vec<&str> = folder_name.rsplitn(4, '-').collect();
        if parts.len() < 4 {
            continue;
        }

        // parts[0] = timestamp, parts[1] = file version, parts[2] = mod id, parts[3] = name prefix
        let timestamp_ok = parts[0].chars().all(|c| c.is_ascii_digit()) && !parts[0].is_empty();
        let version_ok = parts[1].chars().all(|c| c.is_ascii_digit()) && !parts[1].is_empty();
        let mod_id_str = parts[2];
        let mod_id_ok = mod_id_str.chars().all(|c| c.is_ascii_digit()) && !mod_id_str.is_empty();

        if !timestamp_ok || !version_ok || !mod_id_ok {
            continue;
        }

        let mod_id: u64 = match mod_id_str.parse() {
            Ok(id) => id,
            Err(_) => continue,
        };

        // Try to match this folder to a JSON file
        // The folder name prefix (before the numbers) should loosely match a JSON filename
        let name_prefix = parts[3].to_lowercase().replace(' ', "").replace('_', "");

        let mut matched_file: Option<String> = None;

        // First: check if there's a JSON file inside the folder itself
        if let Ok(folder_entries) = fs::read_dir(&path) {
            for fe in folder_entries.filter_map(|e| e.ok()) {
                let fe_path = fe.path();
                if fe_path.extension().map(|ext| ext.to_string_lossy().to_lowercase() == "json").unwrap_or(false) {
                    if let Some(fname) = fe_path.file_name().and_then(|n| n.to_str()) {
                        matched_file = Some(fname.to_string());
                        break;
                    }
                }
            }
        }

        // Second: try matching against root-level JSON files by name similarity
        if matched_file.is_none() {
            for json_file in &json_files {
                let json_stem = json_file.trim_end_matches(".json").to_lowercase().replace(' ', "").replace('_', "");
                if json_stem.contains(&name_prefix) || name_prefix.contains(&json_stem) {
                    matched_file = Some(json_file.clone());
                    break;
                }
            }
        }

        if let Some(file_name) = matched_file {
            mappings.push(NexusIdMapping {
                file_name,
                nexus_mod_id: mod_id,
                folder_name: folder_name.clone(),
            });
        }
    }

    Ok(mappings)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NexusCacheEntry {
    pub file_name: String,
    pub nexus_mod_id: u64,
    pub nexus_name: String,
    pub last_checked: String,
}

fn load_nexus_cache_internal(_mods_path: &str) -> Vec<NexusCacheEntry> {
    Vec::new()
}

/// Check for mod updates — network calls removed for Nexus compliance.
/// Returns empty results since online checking is disabled.
#[tauri::command]
pub fn check_mod_updates(
    _api_key: String,
    _mod_ids: Vec<NexusIdMapping>,
    _mods_path: String,
) -> Result<Vec<ModUpdateStatus>, String> {
    // Network calls removed — update checking disabled for Nexus Mods compliance
    Ok(Vec::new())
}

#[tauri::command]
pub fn search_nexus_by_name(
    _api_key: String,
    _mod_name: String,
    _mods_path: String,
) -> Result<Option<NexusCacheEntry>, String> {
    Ok(None)
}

#[tauri::command]
pub fn search_all_unmatched_mods(
    _api_key: String,
    _mods_path: String,
    _known_mappings: Vec<NexusIdMapping>,
) -> Result<Vec<NexusIdMapping>, String> {
    Ok(Vec::new())
}


#[tauri::command]
pub fn load_nexus_cache(mods_path: String) -> Result<Vec<NexusCacheEntry>, String> {
    Ok(load_nexus_cache_internal(&mods_path))
}

// ─── ReShade Support ───────────────────────────────────────────────────────────

const RESHADE_DLL_NAMES: &[&str] = &["dxgi.dll", "d3d12.dll", "opengl32.dll", "d3d11.dll", "d3d9.dll"];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReshadePreset {
    pub name: String,
    pub file_name: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReshadeStatus {
    pub installed: bool,
    pub enabled: bool,
    pub dll_name: Option<String>,
    pub has_config: bool,
    pub active_preset: Option<String>,
    pub presets: Vec<ReshadePreset>,
    pub shader_count: usize,
}

fn detect_reshade_dll(bin64: &Path) -> Option<(String, bool)> {
    // Check enabled DLLs first
    for &name in RESHADE_DLL_NAMES {
        let path = bin64.join(name);
        if path.exists() {
            // Verify it's actually ReShade: check for reshade.ini or file size > 1MB
            let reshade_ini = bin64.join("reshade.ini");
            if reshade_ini.exists() {
                return Some((name.to_string(), true));
            }
            if let Ok(meta) = fs::metadata(&path) {
                if meta.len() > 1_000_000 {
                    return Some((name.to_string(), true));
                }
            }
        }
    }
    // Check disabled variants
    for &name in RESHADE_DLL_NAMES {
        let disabled_name = format!("{}.disabled", name);
        let path = bin64.join(&disabled_name);
        if path.exists() {
            return Some((name.to_string(), false));
        }
    }
    None
}

fn read_active_preset(bin64: &Path) -> Option<String> {
    let ini_path = bin64.join("reshade.ini");
    if let Ok(content) = fs::read_to_string(&ini_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("PresetPath=") {
                let value = trimmed["PresetPath=".len()..].trim();
                if !value.is_empty() {
                    // Extract just the filename from the path
                    let preset_path = Path::new(value);
                    return Some(
                        preset_path
                            .file_name()
                            .map(|f| f.to_string_lossy().to_string())
                            .unwrap_or_else(|| value.to_string()),
                    );
                }
            }
        }
    }
    None
}

fn scan_reshade_presets(bin64: &Path, active_preset: &Option<String>) -> Vec<ReshadePreset> {
    let mut presets = Vec::new();
    if let Ok(entries) = fs::read_dir(bin64) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let lower = name.to_lowercase();
            if lower.ends_with(".ini") && lower != "reshade.ini" {
                // Check if this looks like a preset (contains shader-related content)
                let is_preset = if let Ok(content) = fs::read_to_string(entry.path()) {
                    content.contains("[GENERAL]")
                        || content.contains("Techniques=")
                        || content.contains("TechniqueSorting=")
                        || content.contains("[DEPTH]")
                        || content.contains("PreprocessorDefinitions=")
                } else {
                    false
                };
                if is_preset {
                    let is_active = active_preset
                        .as_ref()
                        .map(|ap| ap.to_lowercase() == name.to_lowercase())
                        .unwrap_or(false);
                    presets.push(ReshadePreset {
                        name: name[..name.len() - 4].to_string(),
                        file_name: name,
                        is_active,
                    });
                }
            }
        }
    }
    presets.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    presets
}

fn count_shaders(bin64: &Path) -> usize {
    let shader_dir = bin64.join("reshade-shaders").join("Shaders");
    if !shader_dir.exists() {
        return 0;
    }
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(&shader_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.to_lowercase().ends_with(".fx") {
                count += 1;
            }
        }
    }
    count
}

#[tauri::command]
pub fn scan_reshade(game_path: String) -> Result<ReshadeStatus, String> {
    let bin64 = Path::new(&game_path).join("bin64");
    if !bin64.exists() {
        return Ok(ReshadeStatus {
            installed: false,
            enabled: false,
            dll_name: None,
            has_config: false,
            active_preset: None,
            presets: vec![],
            shader_count: 0,
        });
    }

    let detection = detect_reshade_dll(&bin64);
    let has_config = bin64.join("reshade.ini").exists();

    match detection {
        Some((dll_name, enabled)) => {
            let active_preset = read_active_preset(&bin64);
            let presets = scan_reshade_presets(&bin64, &active_preset);
            let shader_count = count_shaders(&bin64);

            Ok(ReshadeStatus {
                installed: true,
                enabled,
                dll_name: Some(dll_name),
                has_config,
                active_preset,
                presets,
                shader_count,
            })
        }
        None => Ok(ReshadeStatus {
            installed: false,
            enabled: false,
            dll_name: None,
            has_config,
            active_preset: None,
            presets: vec![],
            shader_count: 0,
        }),
    }
}

#[tauri::command]
pub fn toggle_reshade(game_path: String, enable: bool) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    if !bin64.exists() {
        return Err("bin64 directory not found".to_string());
    }

    // Find the ReShade DLL (enabled or disabled)
    for &name in RESHADE_DLL_NAMES {
        let enabled_path = bin64.join(name);
        let disabled_path = bin64.join(format!("{}.disabled", name));

        if enable && disabled_path.exists() {
            fs::rename(&disabled_path, &enabled_path)
                .map_err(|e| format!("Failed to enable ReShade: {}", e))?;
            return Ok(());
        } else if !enable && enabled_path.exists() {
            // Verify it's actually ReShade before renaming
            let reshade_ini = bin64.join("reshade.ini");
            let is_reshade = reshade_ini.exists()
                || fs::metadata(&enabled_path)
                    .map(|m| m.len() > 1_000_000)
                    .unwrap_or(false);
            if is_reshade {
                fs::rename(&enabled_path, &disabled_path)
                    .map_err(|e| format!("Failed to disable ReShade: {}", e))?;
                return Ok(());
            }
        }
    }

    Err("ReShade DLL not found".to_string())
}

#[tauri::command]
pub fn set_reshade_preset(game_path: String, preset_name: String) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let ini_path = bin64.join("reshade.ini");

    if !ini_path.exists() {
        return Err("reshade.ini not found".to_string());
    }

    let content = fs::read_to_string(&ini_path)
        .map_err(|e| format!("Failed to read reshade.ini: {}", e))?;

    // Build the new preset path relative to bin64
    let new_preset_path = format!(".\\{}", preset_name);

    let mut found = false;
    let new_content: String = content
        .lines()
        .map(|line| {
            if line.trim().starts_with("PresetPath=") {
                found = true;
                format!("PresetPath={}", new_preset_path)
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let final_content = if found {
        new_content
    } else {
        // If PresetPath not found, add it under [GENERAL] or at the top
        if content.contains("[GENERAL]") {
            content
                .lines()
                .map(|line| {
                    if line.trim() == "[GENERAL]" {
                        format!("{}\nPresetPath={}", line, new_preset_path)
                    } else {
                        line.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            format!("PresetPath={}\n{}", new_preset_path, content)
        }
    };

    fs::write(&ini_path, final_content)
        .map_err(|e| format!("Failed to write reshade.ini: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn open_reshade_config(game_path: String) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let ini_path = bin64.join("reshade.ini");

    if !ini_path.exists() {
        return Err("reshade.ini not found in bin64/".to_string());
    }

    Command::new("cmd")
        .args(["/c", "start", "", &ini_path.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("Failed to open config: {}", e))?;

    Ok(())
}

// ─── ASI / DLL Mod Support ─────────────────────────────────────────────────────

const ASI_LOADER_NAMES: &[&str] = &["winmm.dll", "version.dll", "dinput8.dll", "dsound.dll"];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AsiPlugin {
    pub name: String,
    pub file_name: String,
    pub enabled: bool,
    pub has_ini: bool,
    pub ini_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AsiStatus {
    pub has_loader: bool,
    pub loader_name: Option<String>,
    pub plugins: Vec<AsiPlugin>,
}

#[tauri::command]
pub fn scan_asi_mods(game_path: String) -> Result<AsiStatus, String> {
    let bin64 = Path::new(&game_path).join("bin64");
    if !bin64.exists() {
        return Ok(AsiStatus {
            has_loader: false,
            loader_name: None,
            plugins: vec![],
        });
    }

    // Check for ASI loader
    let mut has_loader = false;
    let mut loader_name: Option<String> = None;
    for &name in ASI_LOADER_NAMES {
        if bin64.join(name).exists() {
            has_loader = true;
            loader_name = Some(name.to_string());
            break;
        }
    }

    // Scan for .asi and .asi.disabled files
    let mut plugins: Vec<AsiPlugin> = Vec::new();
    let entries = fs::read_dir(&bin64).map_err(|e| format!("Failed to read bin64: {}", e))?;

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        let lower = file_name.to_lowercase();

        if lower.ends_with(".asi.disabled") {
            let base_name = file_name[..file_name.len() - ".asi.disabled".len()].to_string();
            let ini_path = find_asi_ini(&bin64, &base_name);
            plugins.push(AsiPlugin {
                name: base_name,
                file_name: file_name.clone(),
                enabled: false,
                has_ini: ini_path.is_some(),
                ini_path: ini_path.map(|p| p.to_string_lossy().to_string()),
            });
        } else if lower.ends_with(".asi") {
            let base_name = file_name[..file_name.len() - ".asi".len()].to_string();
            let ini_path = find_asi_ini(&bin64, &base_name);
            plugins.push(AsiPlugin {
                name: base_name,
                file_name: file_name.clone(),
                enabled: true,
                has_ini: ini_path.is_some(),
                ini_path: ini_path.map(|p| p.to_string_lossy().to_string()),
            });
        }
    }

    plugins.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(AsiStatus {
        has_loader,
        loader_name,
        plugins,
    })
}

fn find_asi_ini(bin64: &Path, base_name: &str) -> Option<std::path::PathBuf> {
    // Try exact match first
    let exact = bin64.join(format!("{}.ini", base_name));
    if exact.exists() {
        return Some(exact);
    }
    // Try any INI whose stem starts with the base name
    let lower_base = base_name.to_lowercase();
    if let Ok(entries) = fs::read_dir(bin64) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();
            if name_lower.ends_with(".ini") {
                let stem = &name_lower[..name_lower.len() - 4];
                if stem.starts_with(&lower_base) {
                    return Some(entry.path());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn enable_asi_mod(game_path: String, plugin_name: String) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let disabled = bin64.join(format!("{}.asi.disabled", plugin_name));
    let enabled = bin64.join(format!("{}.asi", plugin_name));

    if !disabled.exists() {
        return Err(format!("Disabled ASI not found: {}", disabled.display()));
    }

    fs::rename(&disabled, &enabled)
        .map_err(|e| format!("Failed to enable ASI mod: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn disable_asi_mod(game_path: String, plugin_name: String) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let enabled = bin64.join(format!("{}.asi", plugin_name));
    let disabled = bin64.join(format!("{}.asi.disabled", plugin_name));

    if !enabled.exists() {
        return Err(format!("ASI file not found: {}", enabled.display()));
    }

    fs::rename(&enabled, &disabled)
        .map_err(|e| format!("Failed to disable ASI mod: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn install_asi_mod(source_path: String, game_path: String) -> Result<Vec<String>, String> {
    let bin64 = Path::new(&game_path).join("bin64");
    fs::create_dir_all(&bin64).map_err(|e| format!("Failed to create bin64: {}", e))?;

    let source = Path::new(&source_path);
    let mut installed: Vec<String> = Vec::new();

    if source.is_file() && source.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("asi")) {
        // Single .asi file: copy it + companion files from same directory
        let dest = bin64.join(source.file_name().unwrap());
        fs::copy(source, &dest).map_err(|e| format!("Failed to copy ASI: {}", e))?;
        installed.push(source.file_name().unwrap().to_string_lossy().to_string());

        if let Some(parent) = source.parent() {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path == *source || !path.is_file() {
                        continue;
                    }
                    let name = entry.file_name().to_string_lossy().to_string();
                    let lower = name.to_lowercase();

                    if lower.ends_with(".ini") {
                        let dest = bin64.join(&name);
                        fs::copy(&path, &dest).map_err(|e| format!("Failed to copy INI: {}", e))?;
                        installed.push(name);
                    } else if ASI_LOADER_NAMES.contains(&lower.as_str()) && !bin64.join(&name).exists() {
                        fs::copy(&path, bin64.join(&name)).map_err(|e| format!("Failed to copy loader DLL: {}", e))?;
                        installed.push(name);
                    }
                }
            }
        }
    } else if source.is_dir() {
        // Directory: copy all .asi, .ini, and loader DLLs
        fn walk_dir(dir: &Path, bin64: &Path, installed: &mut Vec<String>) -> Result<(), String> {
            let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read dir: {}", e))?;
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk_dir(&path, bin64, installed)?;
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                let lower = name.to_lowercase();

                if lower.ends_with(".asi") || lower.ends_with(".ini") {
                    let dest = bin64.join(&name);
                    fs::copy(&path, &dest).map_err(|e| format!("Failed to copy {}: {}", name, e))?;
                    installed.push(name);
                } else if ASI_LOADER_NAMES.contains(&lower.as_str()) && !bin64.join(&name).exists() {
                    fs::copy(&path, bin64.join(&name)).map_err(|e| format!("Failed to copy loader: {}", e))?;
                    installed.push(name);
                }
            }
            Ok(())
        }
        walk_dir(source, &bin64, &mut installed)?;
    } else {
        return Err("Source must be an .asi file or a directory".to_string());
    }

    Ok(installed)
}

#[tauri::command]
pub fn uninstall_asi_mod(game_path: String, plugin_name: String) -> Result<Vec<String>, String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let mut deleted: Vec<String> = Vec::new();

    // Delete the .asi or .asi.disabled file
    let asi_path = bin64.join(format!("{}.asi", plugin_name));
    let disabled_path = bin64.join(format!("{}.asi.disabled", plugin_name));

    if asi_path.exists() {
        fs::remove_file(&asi_path).map_err(|e| format!("Failed to delete ASI: {}", e))?;
        deleted.push(format!("{}.asi", plugin_name));
    } else if disabled_path.exists() {
        fs::remove_file(&disabled_path).map_err(|e| format!("Failed to delete disabled ASI: {}", e))?;
        deleted.push(format!("{}.asi.disabled", plugin_name));
    } else {
        return Err(format!("ASI plugin not found: {}", plugin_name));
    }

    // Delete companion INI files
    let lower_name = plugin_name.to_lowercase();
    if let Ok(entries) = fs::read_dir(&bin64) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();
            if name_lower.ends_with(".ini") {
                let stem = &name_lower[..name_lower.len() - 4];
                if stem.starts_with(&lower_name) {
                    fs::remove_file(entry.path())
                        .map_err(|e| format!("Failed to delete INI {}: {}", name, e))?;
                    deleted.push(name);
                }
            }
        }
    }

    Ok(deleted)
}

#[tauri::command]
pub fn open_asi_config(game_path: String, plugin_name: String) -> Result<(), String> {
    let bin64 = Path::new(&game_path).join("bin64");
    let ini_path = find_asi_ini(&bin64, &plugin_name)
        .ok_or_else(|| format!("No INI config found for {}", plugin_name))?;

    Command::new("cmd")
        .args(["/c", "start", "", &ini_path.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("Failed to open config: {}", e))?;

    Ok(())
}

/// Ultimate ASI Loader x64 DLL embedded at compile time (no network calls)
const EMBEDDED_ASI_LOADER: &[u8] = include_bytes!("../asi_loader.dll");

#[tauri::command]
pub fn install_asi_loader(game_path: String) -> Result<String, String> {
    let bin64 = Path::new(&game_path).join("bin64");
    if !bin64.exists() {
        return Err("bin64 directory not found".to_string());
    }

    let loader_names = ["version.dll", "winmm.dll", "dinput8.dll", "dsound.dll"];
    for name in &loader_names {
        if bin64.join(name).exists() {
            return Err(format!("ASI Loader already installed as {}", name));
        }
    }

    let target_name = "version.dll";
    let dest = bin64.join(target_name);
    fs::write(&dest, EMBEDDED_ASI_LOADER)
        .map_err(|e| format!("Failed to write {}: {}", target_name, e))?;

    Ok(format!("ASI Loader installed as {} in bin64/", target_name))
}

// =============================================================================
// Mod Packs
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModPack {
    pub name: String,
    pub description: String,
    pub author: String,
    pub created: String,
    pub version: String,
    pub mods: Vec<ModPackEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModPackEntry {
    pub file_name: String,
    pub title: String,
    pub version: String,
    pub disabled_indices: Vec<usize>,
    pub mod_data: Option<String>,
}

#[tauri::command]
pub fn create_mod_pack(
    name: String,
    description: String,
    author: String,
    mods_path: String,
    active_mods: Vec<ActiveMod>,
) -> Result<String, String> {
    let mods_dir = Path::new(&mods_path);
    let packs_dir = mods_dir.parent()
        .ok_or("Cannot determine parent directory")?
        .join("packs");

    if !packs_dir.exists() {
        fs::create_dir_all(&packs_dir)
            .map_err(|e| format!("Failed to create packs directory: {}", e))?;
    }

    let mut entries = Vec::new();
    for am in &active_mods {
        let mod_path = mods_dir.join(&am.file_name);
        if !mod_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&mod_path)
            .map_err(|e| format!("Failed to read mod {}: {}", am.file_name, e))?;

        let mod_file: ModFile = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse mod {}: {}", am.file_name, e))?;

        let (title, version, _author, _desc) = get_mod_display_info(&mod_file);

        let encoded = BASE64.encode(content.as_bytes());

        entries.push(ModPackEntry {
            file_name: am.file_name.clone(),
            title,
            version,
            disabled_indices: am.disabled_indices.clone(),
            mod_data: Some(encoded),
        });
    }

    let pack = ModPack {
        name: name.clone(),
        description,
        author,
        created: chrono::Local::now().to_rfc3339(),
        version: "1.0".to_string(),
        mods: entries,
    };

    let file_name = format!("{}.dmpack", sanitize_filename(&name));
    let pack_path = packs_dir.join(&file_name);

    let content = serde_json::to_string_pretty(&pack)
        .map_err(|e| format!("Failed to serialize mod pack: {}", e))?;
    fs::write(&pack_path, content)
        .map_err(|e| format!("Failed to write mod pack: {}", e))?;

    Ok(pack_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_mod_pack(
    pack_path: String,
    mods_path: String,
) -> Result<ModPack, String> {
    let content = fs::read_to_string(&pack_path)
        .map_err(|e| format!("Failed to read pack file: {}", e))?;
    let pack: ModPack = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse pack file: {}", e))?;

    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        fs::create_dir_all(mods_dir)
            .map_err(|e| format!("Failed to create mods directory: {}", e))?;
    }

    for entry in &pack.mods {
        if let Some(ref data) = entry.mod_data {
            let decoded = BASE64.decode(data)
                .map_err(|e| format!("Failed to decode mod data for {}: {}", entry.file_name, e))?;
            let dest = mods_dir.join(&entry.file_name);
            fs::write(&dest, decoded)
                .map_err(|e| format!("Failed to write mod {}: {}", entry.file_name, e))?;
        }
    }

    Ok(pack)
}

#[tauri::command]
pub fn list_mod_packs(packs_path: String) -> Result<Vec<ModPack>, String> {
    let dir = Path::new(&packs_path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut packs = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read packs directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) != Some("dmpack") {
            continue;
        }

        match fs::read_to_string(&path) {
            Ok(content) => {
                if let Ok(pack) = serde_json::from_str::<ModPack>(&content) {
                    packs.push(pack);
                }
            }
            Err(e) => {
                log::warn!("Skipping pack {}: {}", path.display(), e);
            }
        }
    }

    packs.sort_by(|a, b| b.created.cmp(&a.created));
    Ok(packs)
}

#[tauri::command]
pub fn delete_mod_pack(packs_path: String, pack_name: String) -> Result<(), String> {
    let file_name = format!("{}.dmpack", sanitize_filename(&pack_name));
    let path = Path::new(&packs_path).join(&file_name);

    if !path.exists() {
        return Err(format!("Pack '{}' not found", pack_name));
    }

    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete pack '{}': {}", pack_name, e))
}

// =============================================================================
// Backup Snapshots
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Snapshot {
    pub name: String,
    pub created: String,
    pub mod_count: usize,
    pub description: String,
}

#[tauri::command]
pub fn create_snapshot(
    name: String,
    description: String,
    mods_path: String,
    backup_dir: String,
    config: AppConfig,
) -> Result<Snapshot, String> {
    let snapshots_dir = Path::new(&backup_dir).join("snapshots").join(sanitize_filename(&name));
    if snapshots_dir.exists() {
        return Err(format!("Snapshot '{}' already exists", name));
    }
    fs::create_dir_all(&snapshots_dir)
        .map_err(|e| format!("Failed to create snapshot directory: {}", e))?;

    // Save the config
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(snapshots_dir.join("config.json"), &config_json)
        .map_err(|e| format!("Failed to write config snapshot: {}", e))?;

    // Copy all active mod files
    let mods_dir = Path::new(&mods_path);
    let mods_snapshot_dir = snapshots_dir.join("mods");
    fs::create_dir_all(&mods_snapshot_dir)
        .map_err(|e| format!("Failed to create mods snapshot dir: {}", e))?;

    let mut mod_count = 0;
    for am in &config.active_mods {
        let src = mods_dir.join(&am.file_name);
        if src.exists() {
            let dest = mods_snapshot_dir.join(&am.file_name);
            fs::copy(&src, &dest)
                .map_err(|e| format!("Failed to copy mod {}: {}", am.file_name, e))?;
            mod_count += 1;
        }
    }

    let snapshot = Snapshot {
        name: name.clone(),
        created: chrono::Local::now().to_rfc3339(),
        mod_count,
        description: description.clone(),
    };

    let meta_json = serde_json::to_string_pretty(&snapshot)
        .map_err(|e| format!("Failed to serialize snapshot meta: {}", e))?;
    fs::write(snapshots_dir.join("snapshot.json"), &meta_json)
        .map_err(|e| format!("Failed to write snapshot meta: {}", e))?;

    Ok(snapshot)
}

#[tauri::command]
pub fn list_snapshots(backup_dir: String) -> Result<Vec<Snapshot>, String> {
    let snapshots_dir = Path::new(&backup_dir).join("snapshots");
    if !snapshots_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();
    let entries = fs::read_dir(&snapshots_dir)
        .map_err(|e| format!("Failed to read snapshots directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let meta_path = path.join("snapshot.json");
        if !meta_path.exists() {
            continue;
        }

        match fs::read_to_string(&meta_path) {
            Ok(content) => {
                if let Ok(snapshot) = serde_json::from_str::<Snapshot>(&content) {
                    snapshots.push(snapshot);
                }
            }
            Err(e) => {
                log::warn!("Skipping snapshot {}: {}", path.display(), e);
            }
        }
    }

    snapshots.sort_by(|a, b| b.created.cmp(&a.created));
    Ok(snapshots)
}

#[tauri::command]
pub fn restore_snapshot(
    name: String,
    backup_dir: String,
    mods_path: String,
) -> Result<AppConfig, String> {
    let snapshot_dir = Path::new(&backup_dir)
        .join("snapshots")
        .join(sanitize_filename(&name));

    if !snapshot_dir.exists() {
        return Err(format!("Snapshot '{}' not found", name));
    }

    // Read the saved config
    let config_path = snapshot_dir.join("config.json");
    let config_content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read snapshot config: {}", e))?;
    let config: AppConfig = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse snapshot config: {}", e))?;

    // Restore mod files
    let mods_snapshot_dir = snapshot_dir.join("mods");
    if mods_snapshot_dir.exists() {
        let mods_dir = Path::new(&mods_path);
        if !mods_dir.exists() {
            fs::create_dir_all(mods_dir)
                .map_err(|e| format!("Failed to create mods directory: {}", e))?;
        }

        let entries = fs::read_dir(&mods_snapshot_dir)
            .map_err(|e| format!("Failed to read snapshot mods: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
            let src = entry.path();
            if let Some(file_name) = src.file_name() {
                let dest = mods_dir.join(file_name);
                fs::copy(&src, &dest)
                    .map_err(|e| format!("Failed to restore mod {}: {}", file_name.to_string_lossy(), e))?;
            }
        }
    }

    Ok(config)
}

#[tauri::command]
pub fn delete_snapshot(name: String, backup_dir: String) -> Result<(), String> {
    let snapshot_dir = Path::new(&backup_dir)
        .join("snapshots")
        .join(sanitize_filename(&name));

    if !snapshot_dir.exists() {
        return Err(format!("Snapshot '{}' not found", name));
    }

    fs::remove_dir_all(&snapshot_dir)
        .map_err(|e| format!("Failed to delete snapshot '{}': {}", name, e))
}

// =============================================================================
// Mod Creator
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewModData {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub patches: Vec<NewPatch>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewPatch {
    pub game_file: String,
    pub changes: Vec<NewChange>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NewChange {
    pub offset: u64,
    pub label: String,
    pub original: String,
    pub patched: String,
}

#[tauri::command]
pub fn create_mod_json(
    mods_path: String,
    mod_data: NewModData,
) -> Result<String, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        fs::create_dir_all(mods_dir)
            .map_err(|e| format!("Failed to create mods directory: {}", e))?;
    }

    // Validate hex values
    for patch in &mod_data.patches {
        for change in &patch.changes {
            hex::decode(&change.original)
                .map_err(|e| format!("Invalid hex in original for '{}': {}", change.label, e))?;
            hex::decode(&change.patched)
                .map_err(|e| format!("Invalid hex in patched for '{}': {}", change.label, e))?;

            let orig_bytes = hex::decode(&change.original).unwrap();
            let patch_bytes = hex::decode(&change.patched).unwrap();
            if orig_bytes.len() != patch_bytes.len() {
                return Err(format!(
                    "Byte length mismatch for '{}': original {} bytes vs patched {} bytes",
                    change.label, orig_bytes.len(), patch_bytes.len()
                ));
            }
        }
    }

    // Build the mod JSON structure
    let mod_json = serde_json::json!({
        "modinfo": {
            "title": mod_data.name,
            "version": mod_data.version,
            "author": mod_data.author,
            "description": mod_data.description
        },
        "patches": mod_data.patches.iter().map(|p| {
            serde_json::json!({
                "game_file": p.game_file,
                "changes": p.changes.iter().map(|c| {
                    serde_json::json!({
                        "offset": c.offset,
                        "label": c.label,
                        "original": c.original,
                        "patched": c.patched
                    })
                }).collect::<Vec<_>>()
            })
        }).collect::<Vec<_>>()
    });

    let file_name = format!("{}.json", sanitize_filename(&mod_data.name));
    let path = mods_dir.join(&file_name);

    let content = serde_json::to_string_pretty(&mod_json)
        .map_err(|e| format!("Failed to serialize mod: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write mod file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

// =============================================================================
// Mod Compatibility Matrix
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CompatConflict {
    pub game_file: String,
    pub offset: u64,
    pub label_a: String,
    pub label_b: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompatEntry {
    pub mod_a: String,
    pub mod_b: String,
    pub conflicts: Vec<CompatConflict>,
    pub compatible: bool,
}

#[tauri::command]
pub fn get_compatibility_matrix(mods_path: String) -> Result<Vec<CompatEntry>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    // Each mod represented as (name, list of (game_file, offset, label))
    // For browser mods, offset=0 and the "game_file" is the relative path
    let mut all_mods: Vec<(String, Vec<(String, u64, String)>)> = Vec::new();

    let read_dir = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        // JSON byte-patch mods
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(mod_file) = parse_mod_file(&path) {
                let (title, _, _, _) = get_mod_display_info(&mod_file);
                let mut patches: Vec<(String, u64, String)> = Vec::new();
                for patch in &mod_file.patches {
                    for change in &patch.changes {
                        patches.push((patch.game_file.clone(), change.offset, change.label.clone()));
                    }
                }
                all_mods.push((title, patches));
            }
        }

        // Crimson Browser mods (folders with manifest.json)
        if path.is_dir() {
            let manifest_path = path.join("manifest.json");
            if manifest_path.exists() {
                if let Ok(data) = fs::read_to_string(&manifest_path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                        let format = v.get("format").and_then(|f| f.as_str()).unwrap_or("");
                        if format == "crimson_browser_mod_v1" || v.get("files_dir").is_some() {
                            let title = v.get("title").and_then(|t| t.as_str())
                                .unwrap_or_else(|| path.file_name().unwrap().to_str().unwrap_or("Unknown"))
                                .to_string();
                            let files_dir_name = v.get("files_dir").and_then(|f| f.as_str()).unwrap_or("files");
                            let files_dir = path.join(files_dir_name);

                            let mut patches: Vec<(String, u64, String)> = Vec::new();
                            fn collect_file_entries(dir: &Path, base: &Path, patches: &mut Vec<(String, u64, String)>) {
                                if let Ok(rd) = fs::read_dir(dir) {
                                    for e in rd.filter_map(|e| e.ok()) {
                                        let p = e.path();
                                        if p.is_dir() { collect_file_entries(&p, base, patches); }
                                        else if let Ok(rel) = p.strip_prefix(base) {
                                            let rel_str = rel.to_string_lossy().replace('\\', "/");
                                            patches.push((rel_str.clone(), 0, format!("replaces {}", rel_str)));
                                        }
                                    }
                                }
                            }
                            if files_dir.exists() {
                                collect_file_entries(&files_dir, &files_dir, &mut patches);
                            }
                            if !patches.is_empty() {
                                all_mods.push((title, patches));
                            }
                        }
                    }
                }
            }
        }
    }

    let mut matrix: Vec<CompatEntry> = Vec::new();

    for i in 0..all_mods.len() {
        for j in (i + 1)..all_mods.len() {
            let (ref name_a, ref patches_a) = all_mods[i];
            let (ref name_b, ref patches_b) = all_mods[j];

            let mut conflicts: Vec<CompatConflict> = Vec::new();

            for (gf_a, off_a, label_a) in patches_a {
                for (gf_b, off_b, label_b) in patches_b {
                    // JSON vs JSON: same file + same offset
                    // Browser vs Browser: same file path (offset both 0)
                    // JSON vs Browser: only if they target the same game_file
                    if gf_a == gf_b && off_a == off_b {
                        conflicts.push(CompatConflict {
                            game_file: gf_a.clone(),
                            offset: *off_a,
                            label_a: label_a.clone(),
                            label_b: label_b.clone(),
                        });
                    }
                }
            }

            let compatible = conflicts.is_empty();
            matrix.push(CompatEntry {
                mod_a: name_a.clone(),
                mod_b: name_b.clone(),
                conflicts,
                compatible,
            });
        }
    }

    Ok(matrix)
}

// =============================================================================
// Nexus Mod Thumbnail Fetching
// =============================================================================

#[tauri::command]
pub fn fetch_mod_thumbnail(_nexus_mod_id: u64, _api_key: String, cache_dir: String) -> Result<String, String> {
    // Return cached thumbnail if it exists, but don't fetch new ones (no network calls)
    let thumbs_dir = Path::new(&cache_dir).join("thumbs");
    let cached_path = thumbs_dir.join(format!("{}.jpg", _nexus_mod_id));
    if cached_path.exists() {
        return Ok(cached_path.to_string_lossy().to_string());
    }
    Err("Thumbnail fetching disabled (offline mode)".to_string())
}


// =============================================================================
// Texture Mods (PATHC / DDS Support)
// =============================================================================

#[derive(Debug, Clone)]
struct PathcHeader {
    unknown0: u32,
    unknown1: u32,
    dds_record_size: u32,
    dds_record_count: u32,
    hash_count: u32,
    collision_path_count: u32,
    collision_blob_size: u32,
}

#[derive(Debug, Clone)]
struct PathcMapEntry {
    selector: u32,
    m1: u32,
    m2: u32,
    m3: u32,
    m4: u32,
}

#[derive(Debug, Clone)]
struct PathcCollisionEntry {
    path_offset: u32,
    dds_index: u32,
    m1: u32,
    m2: u32,
    m3: u32,
    m4: u32,
    path: String,
}

#[derive(Debug, Clone)]
struct PathcFile {
    header: PathcHeader,
    dds_records: Vec<Vec<u8>>,
    key_hashes: Vec<u32>,
    map_entries: Vec<PathcMapEntry>,
    collision_entries: Vec<PathcCollisionEntry>,
}

fn read_pathc(path: &Path) -> Result<PathcFile, String> {
    let raw = fs::read(path).map_err(|e| format!("Failed to read PATHC: {}", e))?;
    if raw.len() < 0x1C {
        return Err("File too small to be a valid .pathc".to_string());
    }

    let r = |off: usize| u32::from_le_bytes(raw[off..off + 4].try_into().unwrap());
    let header = PathcHeader {
        unknown0: r(0), unknown1: r(4), dds_record_size: r(8),
        dds_record_count: r(12), hash_count: r(16),
        collision_path_count: r(20), collision_blob_size: r(24),
    };

    let rs = header.dds_record_size as usize;
    let dds_off = 0x1C;
    let hash_off = dds_off + rs * header.dds_record_count as usize;
    let map_off = hash_off + header.hash_count as usize * 4;
    let coll_off = map_off + header.hash_count as usize * 20;
    let blob_off = coll_off + header.collision_path_count as usize * 24;

    let mut dds_records = Vec::new();
    for i in 0..header.dds_record_count as usize {
        let off = dds_off + i * rs;
        dds_records.push(raw[off..off + rs].to_vec());
    }

    let mut key_hashes = Vec::new();
    for i in 0..header.hash_count as usize {
        key_hashes.push(u32::from_le_bytes(raw[hash_off + i * 4..hash_off + i * 4 + 4].try_into().unwrap()));
    }

    let mut map_entries = Vec::new();
    for i in 0..header.hash_count as usize {
        let o = map_off + i * 20;
        map_entries.push(PathcMapEntry {
            selector: r(o), m1: r(o + 4), m2: r(o + 8), m3: r(o + 12), m4: r(o + 16),
        });
    }

    let blob = if blob_off < raw.len() {
        &raw[blob_off..std::cmp::min(blob_off + header.collision_blob_size as usize, raw.len())]
    } else {
        &[] as &[u8]
    };

    let mut collision_entries = Vec::new();
    for i in 0..header.collision_path_count as usize {
        let o = coll_off + i * 24;
        let poff = r(o);
        let dds_idx = r(o + 4);
        let m1 = r(o + 8);
        let m2 = r(o + 12);
        let m3 = r(o + 16);
        let m4 = r(o + 20);
        let path_str = if (poff as usize) < blob.len() {
            let end = blob[poff as usize..].iter().position(|&b| b == 0).unwrap_or(blob.len() - poff as usize);
            String::from_utf8_lossy(&blob[poff as usize..poff as usize + end]).to_string()
        } else {
            String::new()
        };
        collision_entries.push(PathcCollisionEntry { path_offset: poff, dds_index: dds_idx, m1, m2, m3, m4, path: path_str });
    }

    Ok(PathcFile { header, dds_records, key_hashes, map_entries, collision_entries })
}

fn serialize_pathc(pathc: &PathcFile) -> Vec<u8> {
    let mut collision_blob: Vec<u8> = Vec::new();
    let mut collision_rows: Vec<[u8; 24]> = Vec::new();

    for entry in &pathc.collision_entries {
        let poff = collision_blob.len() as u32;
        collision_blob.extend_from_slice(entry.path.as_bytes());
        collision_blob.push(0);
        let mut row = [0u8; 24];
        row[0..4].copy_from_slice(&poff.to_le_bytes());
        row[4..8].copy_from_slice(&entry.dds_index.to_le_bytes());
        row[8..12].copy_from_slice(&entry.m1.to_le_bytes());
        row[12..16].copy_from_slice(&entry.m2.to_le_bytes());
        row[16..20].copy_from_slice(&entry.m3.to_le_bytes());
        row[20..24].copy_from_slice(&entry.m4.to_le_bytes());
        collision_rows.push(row);
    }

    let dds_count = pathc.dds_records.len() as u32;
    let hash_count = pathc.key_hashes.len() as u32;
    let coll_count = pathc.collision_entries.len() as u32;
    let blob_size = collision_blob.len() as u32;

    let mut out: Vec<u8> = Vec::new();
    // Header
    out.extend_from_slice(&pathc.header.unknown0.to_le_bytes());
    out.extend_from_slice(&pathc.header.unknown1.to_le_bytes());
    out.extend_from_slice(&pathc.header.dds_record_size.to_le_bytes());
    out.extend_from_slice(&dds_count.to_le_bytes());
    out.extend_from_slice(&hash_count.to_le_bytes());
    out.extend_from_slice(&coll_count.to_le_bytes());
    out.extend_from_slice(&blob_size.to_le_bytes());

    for rec in &pathc.dds_records {
        out.extend_from_slice(rec);
    }

    for h in &pathc.key_hashes {
        out.extend_from_slice(&h.to_le_bytes());
    }

    for entry in &pathc.map_entries {
        out.extend_from_slice(&entry.selector.to_le_bytes());
        out.extend_from_slice(&entry.m1.to_le_bytes());
        out.extend_from_slice(&entry.m2.to_le_bytes());
        out.extend_from_slice(&entry.m3.to_le_bytes());
        out.extend_from_slice(&entry.m4.to_le_bytes());
    }

    for row in &collision_rows {
        out.extend_from_slice(row);
    }
    out.extend_from_slice(&collision_blob);
    out
}

fn normalize_pathc_path(p: &str) -> String {
    let s = p.replace('\\', "/");
    let trimmed = s.trim().trim_matches('/');
    format!("/{}", trimmed)
}

fn get_pathc_hash(virtual_path: &str) -> u32 {
    let norm = normalize_pathc_path(virtual_path).to_lowercase();
    hashlittle(norm.as_bytes(), INTEGRITY_SEED)
}

/// Block-compression bytes per block by DDS FourCC
fn bc_block_bytes_by_fourcc(fourcc: &[u8; 4]) -> Option<usize> {
    match fourcc {
        b"DXT1" | b"ATI1" | b"BC4U" | b"BC4S" => Some(8),
        b"DXT3" | b"DXT5" | b"ATI2" | b"BC5U" | b"BC5S" => Some(16),
        _ => None,
    }
}

fn bc_block_bytes_by_dxgi(dxgi: u32) -> Option<usize> {
    match dxgi {
        70 | 71 | 72 | 79 | 80 | 81 => Some(8),
        73 | 74 | 75 | 76 | 77 | 78 | 82 | 83 | 84 | 94 | 95 | 96 | 97 | 98 | 99 => Some(16),
        _ => None,
    }
}

fn dxgi_bits_per_pixel(dxgi: u32) -> u32 {
    match dxgi {
        10 => 64, 24 | 28 => 32, 61 => 8, _ => 0,
    }
}

fn get_dds_metadata(data: &[u8]) -> (u32, u32, u32, u32) {
    if data.len() < 128 || &data[0..4] != b"DDS " {
        return (0, 0, 0, 0);
    }
    let r = |off: usize| u32::from_le_bytes(data[off..off + 4].try_into().unwrap());
    let height = r(12);
    let width = r(16);
    let pitch = r(20);
    let mips = std::cmp::max(1, r(28));

    let pf_flags = r(80);
    let pf_fourcc_raw = r(84);
    let pf_rgb_bits = r(88);
    let fourcc: [u8; 4] = pf_fourcc_raw.to_le_bytes();

    let dxgi = if &fourcc == b"DX10" && data.len() >= 148 {
        Some(r(128))
    } else {
        None
    };

    let block_bytes = bc_block_bytes_by_fourcc(&fourcc)
        .or_else(|| dxgi.and_then(bc_block_bytes_by_dxgi));

    let bpp = if block_bytes.is_none() {
        let mut b = dxgi.map(dxgi_bits_per_pixel).unwrap_or(0);
        if b == 0 && (pf_flags & 0x40) != 0 {
            b = pf_rgb_bits;
        }
        b
    } else {
        0
    };

    let mut sizes = Vec::new();
    let mut cw = std::cmp::max(1, width);
    let mut ch = std::cmp::max(1, height);

    for i in 0..std::cmp::min(4, mips) {
        let size = if let Some(bb) = block_bytes {
            (std::cmp::max(1, (cw + 3) / 4) * std::cmp::max(1, (ch + 3) / 4)) as usize * bb
        } else if bpp > 0 {
            (((cw * bpp + 7) / 8) * ch) as usize
        } else if i == 0 && pitch > 0 {
            pitch as usize
        } else {
            0
        };
        sizes.push((size as u32) & 0xFFFFFFFF);
        cw = std::cmp::max(1, cw / 2);
        ch = std::cmp::max(1, ch / 2);
    }

    while sizes.len() < 4 {
        sizes.push(0);
    }
    (sizes[0], sizes[1], sizes[2], sizes[3])
}

fn create_dds_record(dds_path: &Path, record_size: usize) -> Result<Vec<u8>, String> {
    let data = fs::read(dds_path).map_err(|e| format!("Failed to read DDS: {}", e))?;
    if !data.starts_with(b"DDS ") {
        return Err(format!("Not a valid DDS file: {}", dds_path.display()));
    }
    let mut record = vec![0u8; record_size];
    let to_copy = std::cmp::min(data.len(), record_size);
    record[..to_copy].copy_from_slice(&data[..to_copy]);
    Ok(record)
}

fn update_pathc_entry(pathc: &mut PathcFile, virtual_path: &str, dds_index: u32, m: (u32, u32, u32, u32)) {
    let target_hash = get_pathc_hash(virtual_path);
    let idx = pathc.key_hashes.partition_point(|&h| h < target_hash);
    let selector = 0xFFFF0000 | (dds_index & 0xFFFF);

    if idx < pathc.key_hashes.len() && pathc.key_hashes[idx] == target_hash {
        pathc.map_entries[idx].selector = selector;
        pathc.map_entries[idx].m1 = m.0;
        pathc.map_entries[idx].m2 = m.1;
        pathc.map_entries[idx].m3 = m.2;
        pathc.map_entries[idx].m4 = m.3;
    } else {
        pathc.key_hashes.insert(idx, target_hash);
        pathc.map_entries.insert(idx, PathcMapEntry { selector, m1: m.0, m2: m.1, m3: m.2, m4: m.3 });
    }
}

fn add_dds_to_pathc(pathc: &mut PathcFile, dds_path: &Path, virtual_path: &str) -> Result<u32, String> {
    let record_size = pathc.header.dds_record_size as usize;
    let dds_rec = create_dds_record(dds_path, record_size)?;
    let dds_data = fs::read(dds_path).map_err(|e| format!("Failed to read DDS: {}", e))?;
    let m = get_dds_metadata(&dds_data);

    // Deduplicate: reuse existing record if identical
    let dds_idx = if let Some(pos) = pathc.dds_records.iter().position(|r| r == &dds_rec) {
        pos as u32
    } else {
        pathc.dds_records.push(dds_rec);
        (pathc.dds_records.len() - 1) as u32
    };

    update_pathc_entry(pathc, virtual_path, dds_idx, m);
    Ok(dds_idx)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TextureModEntry {
    pub folder_name: String,
    pub name: String,
    pub dds_count: usize,
}

#[tauri::command]
pub fn scan_texture_mods(mods_path: String) -> Result<Vec<TextureModEntry>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Err("Mods directory does not exist".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let folder_name = path.file_name().unwrap().to_string_lossy().to_string();

        // Skip folders that look like PAZ/PAMT archives
        let has_paz = path.join("0.paz").exists() || fs::read_dir(&path)
            .map(|rd| rd.filter_map(|e| e.ok()).any(|e| {
                let n = e.file_name().to_string_lossy().to_lowercase();
                n.ends_with(".paz") || n.ends_with(".pamt")
            }))
            .unwrap_or(false);
        if has_paz {
            continue;
        }

        // Count .dds files recursively
        let mut dds_count = 0usize;
        fn count_dds(dir: &Path, count: &mut usize) {
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.filter_map(|e| e.ok()) {
                    let p = e.path();
                    if p.is_dir() {
                        count_dds(&p, count);
                    } else if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("dds")).unwrap_or(false) {
                        *count += 1;
                    }
                }
            }
        }
        count_dds(&path, &mut dds_count);

        if dds_count > 0 {
            entries.push(TextureModEntry {
                folder_name: folder_name.clone(),
                name: folder_name,
                dds_count,
            });
        }
    }

    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextureApplyResult {
    pub success: bool,
    pub textures_applied: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn apply_texture_mods(
    game_path: String,
    backup_dir: String,
    texture_folders: Vec<String>,
    mods_path: String,
) -> Result<TextureApplyResult, String> {
    let pathc_path = Path::new(&game_path).join("meta").join("0.pathc");
    let backup_path = Path::new(&backup_dir);
    let pathc_backup = backup_path.join("pathc_clean.bin");

    if !backup_path.exists() {
        fs::create_dir_all(backup_path)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    // Backup vanilla PATHC (first time only)
    if !pathc_backup.exists() && pathc_path.exists() {
        fs::copy(&pathc_path, &pathc_backup)
            .map_err(|e| format!("Failed to backup PATHC: {}", e))?;
    }

    // Read from backup (clean state) or current
    let source = if pathc_backup.exists() { &pathc_backup } else { &pathc_path };
    if !source.exists() {
        return Err("No PATHC file found at meta/0.pathc".to_string());
    }

    let mut pathc = read_pathc(source)?;
    let mut total_applied = 0usize;
    let mut errors = Vec::new();
    let mods_dir = Path::new(&mods_path);

    for folder_name in &texture_folders {
        let folder = mods_dir.join(folder_name);
        if !folder.exists() || !folder.is_dir() {
            errors.push(format!("Folder not found: {}", folder_name));
            continue;
        }

        // Find all .dds files recursively
        fn find_dds(dir: &Path, base: &Path, results: &mut Vec<(std::path::PathBuf, String)>) {
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.filter_map(|e| e.ok()) {
                    let p = e.path();
                    if p.is_dir() {
                        find_dds(&p, base, results);
                    } else if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("dds")).unwrap_or(false) {
                        if let Ok(rel) = p.strip_prefix(base) {
                            let vpath = "/".to_string() + &rel.to_string_lossy().replace('\\', "/");
                            results.push((p.clone(), vpath));
                        }
                    }
                }
            }
        }

        let mut dds_files: Vec<(std::path::PathBuf, String)> = Vec::new();
        find_dds(&folder, &folder, &mut dds_files);
        dds_files.sort_by(|a, b| a.1.cmp(&b.1));

        for (dds_path, vpath) in &dds_files {
            match add_dds_to_pathc(&mut pathc, dds_path, vpath) {
                Ok(_) => total_applied += 1,
                Err(e) => errors.push(format!("{}: {}", vpath, e)),
            }
        }
    }

    // Serialize and write
    let data = serialize_pathc(&pathc);
    fs::write(&pathc_path, data)
        .map_err(|e| format!("Failed to write modified PATHC: {}", e))?;

    Ok(TextureApplyResult {
        success: errors.is_empty(),
        textures_applied: total_applied,
        errors,
    })
}

#[tauri::command]
pub fn revert_texture_mods(game_path: String, backup_dir: String) -> Result<String, String> {
    let pathc_backup = Path::new(&backup_dir).join("pathc_clean.bin");
    let pathc_path = Path::new(&game_path).join("meta").join("0.pathc");

    if !pathc_backup.exists() {
        return Err("No clean PATHC backup found".to_string());
    }

    fs::copy(&pathc_backup, &pathc_path)
        .map_err(|e| format!("Failed to restore PATHC: {}", e))?;

    Ok("PATHC restored to clean state".to_string())
}

// =============================================================================
// PAZ Replacement Mods
// =============================================================================
// Mods that contain pre-built .paz/.pamt files inside numbered group
// directories. Supports ANY paz index (0.paz, 1.paz, 32.paz, etc.).
// Also handles standalone .paz files placed directly in the mods folder.

#[derive(Debug, Serialize, Deserialize)]
pub struct PazReplaceResult {
    pub success: bool,
    pub groups_patched: Vec<String>,
    pub errors: Vec<String>,
}

/// Check if a filename is a PAZ archive (e.g. "0.paz", "32.paz")
fn is_paz_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".paz") && lower.trim_end_matches(".paz").parse::<u32>().is_ok()
}

/// Check if a filename is a PAMT index (e.g. "0.pamt", "32.pamt")
fn is_pamt_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".pamt") && lower.trim_end_matches(".pamt").parse::<u32>().is_ok()
}

#[tauri::command]
pub fn apply_paz_replace_mods(
    game_path: String,
    backup_dir: String,
    mods_path: String,
    mod_folders: Vec<String>,
) -> Result<PazReplaceResult, String> {
    let backup_path = Path::new(&backup_dir);
    let mods_dir = Path::new(&mods_path);
    let game_dir = Path::new(&game_path);

    if !backup_path.exists() {
        fs::create_dir_all(backup_path)
            .map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }

    let mut groups_patched = Vec::new();
    let mut errors = Vec::new();

    for folder_name in &mod_folders {
        let mod_dir = mods_dir.join(folder_name);

        // Case A: mod_dir is a folder containing numbered group subdirs
        if mod_dir.is_dir() {
            if let Ok(rd) = fs::read_dir(&mod_dir) {
                for entry in rd.filter_map(|e| e.ok()) {
                    let group_name = entry.file_name().to_string_lossy().to_string();
                    if !entry.path().is_dir() || !is_paz_group_dir(&group_name) { continue; }

                    let game_group_dir = game_dir.join(&group_name);
                    if !game_group_dir.exists() {
                        errors.push(format!("Game group {} does not exist", group_name));
                        continue;
                    }

                    // Find ALL .paz and .pamt files in this group dir
                    if let Ok(group_rd) = fs::read_dir(entry.path()) {
                        for file_entry in group_rd.filter_map(|e| e.ok()) {
                            let fname = file_entry.file_name().to_string_lossy().to_string();
                            if !is_paz_file(&fname) && !is_pamt_file(&fname) { continue; }

                            let game_file = game_group_dir.join(&fname);
                            let backup_name = format!("paz_replace_{}_{}", group_name, fname);
                            let file_backup = backup_path.join(&backup_name);

                            // Backup original (first time only)
                            if !file_backup.exists() && game_file.exists() {
                                if let Err(e) = fs::copy(&game_file, &file_backup) {
                                    errors.push(format!("Failed to backup {}/{}: {}", group_name, fname, e));
                                    continue;
                                }
                            }

                            // Copy mod file into game group
                            if let Err(e) = fs::copy(file_entry.path(), &game_file) {
                                errors.push(format!("Failed to copy {} to {}: {}", fname, group_name, e));
                            }
                        }
                    }

                    groups_patched.push(group_name);
                }
            }
        }
    }

    Ok(PazReplaceResult {
        success: errors.is_empty(),
        groups_patched,
        errors,
    })
}

#[tauri::command]
pub fn revert_paz_replace_mods(game_path: String, backup_dir: String) -> Result<Vec<String>, String> {
    let backup_path = Path::new(&backup_dir);
    let game_dir = Path::new(&game_path);
    let mut restored = Vec::new();

    if !backup_path.exists() {
        return Ok(restored);
    }

    if let Ok(rd) = fs::read_dir(backup_path) {
        for entry in rd.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            // Match paz_replace_{group}_{file} pattern
            if !name.starts_with("paz_replace_") { continue; }
            let rest = name.strip_prefix("paz_replace_").unwrap();

            // Parse: group is first 4 digits, then underscore, then filename
            if rest.len() < 6 { continue; } // "0009_0.paz" minimum
            let group = &rest[..4];
            if !is_paz_group_dir(group) { continue; }
            let paz_filename = &rest[5..]; // skip the underscore

            let game_file = game_dir.join(group).join(paz_filename);
            if let Err(e) = fs::copy(entry.path(), &game_file) {
                log::warn!("Failed to restore {}/{}: {}", group, paz_filename, e);
            } else {
                restored.push(format!("{}/{}", group, paz_filename));
            }
            // Clean up backup after restore
            let _ = fs::remove_file(entry.path());
        }
    }

    Ok(restored)
}

// =============================================================================
// File Replacement Mod Detection
// =============================================================================
//
// Detects two formats:
// 1. Manifest mods: folder with manifest.json + files/{group}/{path}
// 2. Loose folder mods: folder containing numbered subdirectories (0000-0036)
//    with game files inside — auto-detected without any manifest needed.
//
// This means ANY game file can be modded by placing it at the right path.

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BrowserModEntry {
    pub folder_name: String,
    pub title: String,
    pub author: String,
    pub version: String,
    pub description: String,
    pub file_count: usize,
    pub enabled: bool,
    pub mod_type: String,
}

fn count_files_recursive(dir: &Path) -> usize {
    let mut count = 0usize;
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.filter_map(|e| e.ok()) {
            let p = e.path();
            if p.is_dir() { count += count_files_recursive(&p); }
            else { count += 1; }
        }
    }
    count
}

/// Check if a directory name looks like a PAZ group number (4-digit, 0000-0036)
fn is_paz_group_dir(name: &str) -> bool {
    name.len() == 4 && name.chars().all(|c| c.is_ascii_digit())
}

#[tauri::command]
pub fn scan_browser_mods(mods_path: String) -> Result<Vec<BrowserModEntry>, String> {
    let mods_dir = Path::new(&mods_path);
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    let mut seen_folders: std::collections::HashSet<String> = std::collections::HashSet::new();
    let read_dir = fs::read_dir(mods_dir)
        .map_err(|e| format!("Failed to read mods directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();
        if !path.is_dir() { continue; }

        let folder_name = path.file_name().unwrap().to_string_lossy().to_string();

        // --- Case 0: Standalone overlay mod (ships pre-built 0036/ PAZ/PAMT) ---
        let standalone_paz = path.join("0036").join("0.paz");
        let standalone_pamt = path.join("0036").join("0.pamt");
        if standalone_paz.exists() && standalone_pamt.exists() {
            // Read modinfo.json if present
            let modinfo_path = path.join("modinfo.json");
            let (title, version, author, description) = if modinfo_path.exists() {
                if let Ok(data) = fs::read_to_string(&modinfo_path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                        (
                            v.get("name").and_then(|v| v.as_str()).unwrap_or(&folder_name).to_string(),
                            v.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            v.get("author").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
                            v.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        )
                    } else { (folder_name.clone(), String::new(), "Unknown".to_string(), String::new()) }
                } else { (folder_name.clone(), String::new(), "Unknown".to_string(), String::new()) }
            } else { (folder_name.clone(), String::new(), "Unknown".to_string(), String::new()) };

            if !seen_folders.contains(&folder_name) {
                seen_folders.insert(folder_name.clone());
                entries.push(BrowserModEntry {
                    folder_name: folder_name.clone(),
                    title,
                    author,
                    version,
                    description,
                    file_count: 2,
                    enabled: false,
                    mod_type: "standalone overlay".to_string(),
                });
            }
            continue;
        }

        // --- Case 1: Manifest-based mod ---
        // Supports: manifest.json (Crimson Browser) or mod.json (modinfo format)
        let manifest_candidates = [path.join("manifest.json"), path.join("mod.json")];
        let mut found_manifest = false;
        for manifest_path in &manifest_candidates {
            if !manifest_path.exists() { continue; }
            let data = match fs::read_to_string(manifest_path) { Ok(d) => d, Err(_) => continue };
            let manifest: serde_json::Value = match serde_json::from_str(&data) { Ok(v) => v, Err(_) => continue };

            // Check if it's a recognized format
            let format = manifest.get("format").and_then(|v| v.as_str()).unwrap_or("");
            let has_files_dir = manifest.get("files_dir").is_some();
            let has_modinfo = manifest.get("modinfo").is_some();
            let files_subdir = path.join("files");

            if format == "crimson_browser_mod_v1" || has_files_dir || (has_modinfo && files_subdir.exists()) {
                // Extract metadata — check both top-level and modinfo nested fields
                let info = manifest.get("modinfo").unwrap_or(&manifest);
                let title = info.get("title").and_then(|v| v.as_str())
                    .or_else(|| manifest.get("title").and_then(|v| v.as_str()))
                    .unwrap_or(&folder_name).to_string();
                let author = info.get("author").and_then(|v| v.as_str())
                    .or_else(|| manifest.get("author").and_then(|v| v.as_str()))
                    .unwrap_or("Unknown").to_string();
                let version = info.get("version").and_then(|v| v.as_str())
                    .or_else(|| manifest.get("version").and_then(|v| v.as_str()))
                    .unwrap_or("").to_string();
                let description = info.get("description").and_then(|v| v.as_str())
                    .or_else(|| manifest.get("description").and_then(|v| v.as_str()))
                    .unwrap_or("").to_string();
                let enabled = manifest.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

                let files_dir = path.join(manifest.get("files_dir").and_then(|v| v.as_str()).unwrap_or("files"));
                let file_count = if files_dir.exists() { count_files_recursive(&files_dir) } else { 0 };

                if file_count > 0 {
                    seen_folders.insert(folder_name.clone());
                    entries.push(BrowserModEntry {
                        folder_name: folder_name.clone(),
                        title,
                        author,
                        version,
                        description,
                        file_count,
                        enabled,
                        mod_type: "file replace".to_string(),
                    });
                    found_manifest = true;
                    break;
                }
            }
        }
        if found_manifest { continue; }

        // --- Case 2: Auto-detect loose folder with numbered PAZ group subdirs ---
        if seen_folders.contains(&folder_name) { continue; }

        let mut paz_file_count = 0usize;
        let mut has_loose_files = false;
        let mut total_files = 0usize;
        let mut has_batch_script = false;

        if let Ok(rd) = fs::read_dir(&path) {
            for sub in rd.filter_map(|e| e.ok()) {
                let sub_name = sub.file_name().to_string_lossy().to_string();
                let sub_lower = sub_name.to_lowercase();

                // Check for batch/script files
                if sub_lower.ends_with(".bat") || sub_lower.ends_with(".ps1") || sub_lower.ends_with(".cmd") {
                    has_batch_script = true;
                }

                if sub.path().is_dir() && is_paz_group_dir(&sub_name) {
                    // Check if this group dir contains any .paz files
                    let mut has_paz = false;
                    if let Ok(group_rd) = fs::read_dir(sub.path()) {
                        for f in group_rd.filter_map(|e| e.ok()) {
                            let fname = f.file_name().to_string_lossy().to_string();
                            if is_paz_file(&fname) {
                                has_paz = true;
                                paz_file_count += 1;
                            }
                        }
                    }
                    if !has_paz {
                        // Loose game files inside numbered dir
                        let count = count_files_recursive(&sub.path());
                        if count > 0 {
                            has_loose_files = true;
                            total_files += count;
                        }
                    }
                }
            }
        }

        // Case 2a: PAZ replacement mod (e.g. MyMod/0009/0.paz or MyMod/0009/32.paz)
        if paz_file_count > 0 {
            let desc = if has_batch_script {
                "Contains installer script — enable to replace PAZ archives directly".to_string()
            } else { String::new() };
            entries.push(BrowserModEntry {
                folder_name: folder_name.clone(),
                title: folder_name.clone(),
                author: "Unknown".to_string(),
                version: String::new(),
                description: desc,
                file_count: paz_file_count,
                enabled: true,
                mod_type: "paz replace".to_string(),
            });
        }

        // Case 2b: Loose file replacement mod (e.g. MyMod/0012/ui/texture/icon.dds)
        if has_loose_files {
            entries.push(BrowserModEntry {
                folder_name: folder_name.clone(),
                title: folder_name.clone(),
                author: "Unknown".to_string(),
                version: String::new(),
                description: String::new(),
                file_count: total_files,
                enabled: true,
                mod_type: "file replace".to_string(),
            });
        }

        // Case 2c: Script-only mod (has .bat but no PAZ or loose files)
        if has_batch_script && paz_file_count == 0 && !has_loose_files {
            entries.push(BrowserModEntry {
                folder_name: folder_name.clone(),
                title: folder_name.clone(),
                author: "Unknown".to_string(),
                version: String::new(),
                description: "This mod uses an installer script — run it manually from the mod folder".to_string(),
                file_count: 0,
                enabled: false,
                mod_type: "script".to_string(),
            });
        }
    }

    // --- Case 3: Standalone .paz files at the mods root ---
    // e.g. someone drops "32.paz" directly into the mods folder
    if let Ok(rd) = fs::read_dir(mods_dir) {
        for entry in rd.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_file() { continue; }
            let fname = entry.file_name().to_string_lossy().to_string();
            if is_paz_file(&fname) {
                entries.push(BrowserModEntry {
                    folder_name: fname.clone(),
                    title: fname.clone(),
                    author: "Unknown".to_string(),
                    version: String::new(),
                    description: "Standalone PAZ file — needs to be placed in a group folder (e.g. 0009/) to mount".to_string(),
                    file_count: 1,
                    enabled: false,
                    mod_type: "standalone paz".to_string(),
                });
            }
        }
    }

    entries.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(entries)
}

// =============================================================================
// Font Replacement
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameFontEntry {
    pub filename: String,
    pub path: String,
    pub group: String,
    pub language: String,
    pub orig_size: u32,
}

#[tauri::command]
pub fn scan_game_fonts(game_path: String) -> Result<Vec<GameFontEntry>, String> {
    let game_dir = Path::new(&game_path);
    if !game_dir.exists() {
        return Err("Game directory not found".to_string());
    }

    let mut fonts = Vec::new();
    let mut dirs: Vec<_> = fs::read_dir(game_dir)
        .map_err(|e| format!("Cannot read game dir: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            e.path().is_dir() && name.chars().all(|c| c.is_ascii_digit()) && name != "0036"
        })
        .collect();
    dirs.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    for entry in &dirs {
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let pamt_path = entry.path().join("0.pamt");
        if !pamt_path.exists() { continue; }
        let data = match fs::read(&pamt_path) { Ok(d) => d, Err(_) => continue };
        let pamt_info = match read_pamt(&data) { Ok(p) => p, Err(_) => continue };
        let file_idx = build_file_index(&pamt_info);

        for (path, rec) in &file_idx {
            let lower = path.to_lowercase();
            if lower.ends_with(".ttf") || lower.ends_with(".otf") {
                let filename = path.rsplit('/').next().unwrap_or(path).to_string();
                // Derive language from filename (e.g. "eng.ttf" → "English")
                let stem = filename.replace(".ttf", "").replace(".otf", "");
                let lang = match stem.as_str() {
                    "eng" => "English",
                    "fre" => "French",
                    "ger" => "German",
                    "ita" => "Italian",
                    "jpn" => "Japanese",
                    "kor" => "Korean",
                    "pol" => "Polish",
                    "por-br" => "Portuguese (BR)",
                    "rus" => "Russian",
                    "spa-es" => "Spanish (ES)",
                    "spa-mx" => "Spanish (MX)",
                    "tur" => "Turkish",
                    "zho-cn" => "Chinese (Simplified)",
                    "zho-tw" => "Chinese (Traditional)",
                    "reditfont" => "Base Font",
                    other => other,
                };
                fonts.push(GameFontEntry {
                    filename: filename.clone(),
                    path: path.clone(),
                    group: dir_name.clone(),
                    language: lang.to_string(),
                    orig_size: rec.decomp_size,
                });
            }
        }
    }

    fonts.sort_by(|a, b| a.language.cmp(&b.language));
    Ok(fonts)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FontReplaceResult {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn replace_game_font(
    game_path: String,
    backup_dir: String,
    font_game_path: String,
    replacement_path: String,
) -> Result<FontReplaceResult, String> {
    let backup_path = Path::new(&backup_dir);
    if !backup_path.exists() {
        fs::create_dir_all(backup_path)
            .map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }

    // Read the replacement font file
    let new_font_data = fs::read(&replacement_path)
        .map_err(|e| format!("Failed to read replacement font: {}", e))?;
    let new_size = new_font_data.len();

    // Find the font in the game archives
    let (group_id, full_path, rec) = find_file_in_game(&game_path, &font_game_path)?;
    let bare_filename = full_path.rsplit('/').next().unwrap_or(&full_path);

    // Backup the original font (first time only)
    let clean_name = format!("font_{}", bare_filename.replace('.', "_"));
    let clean_backup = backup_path.join(&clean_name);
    if !clean_backup.exists() {
        // Extract original font and save as backup
        match extract_from_paz(&game_path, &group_id, &rec, bare_filename) {
            Ok(data) => {
                let _ = fs::write(&clean_backup, &data);
            }
            Err(e) => {
                log::warn!("Could not backup original font: {}", e);
            }
        }
    }

    // Build overlay with the replacement font (same pipeline as pabgb)
    let overlay_dir = Path::new(&game_path).join("0036");
    if !overlay_dir.exists() {
        fs::create_dir_all(&overlay_dir)
            .map_err(|e| format!("Failed to create overlay dir: {}", e))?;
    }

    // LZ4 compress the new font
    let compressed = lz4::block::compress(&new_font_data, None, false)
        .map_err(|e| format!("LZ4 compression failed: {}", e))?;

    let dir_path = full_path.rsplit('/').skip(1).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("/");

    // Build single-file overlay PAZ + PAMT
    let mut paz_data: Vec<u8> = Vec::new();
    let paz_offset = 0u32;
    let comp_size = compressed.len() as u32;
    let decomp_size = new_font_data.len() as u32;

    paz_data.extend_from_slice(&compressed);
    let padded_size = (paz_data.len() + 15) & !15;
    paz_data.resize(padded_size, 0);

    let overlay_file = OverlayFileInfo {
        dir_path: dir_path.clone(),
        filename: bare_filename.to_string(),
        paz_offset,
        comp_size,
        decomp_size,
        flags: 0x0002, // LZ4
    };

    let paz_total_len = paz_data.len() as u32;
    let mut new_pamt = build_multi_pamt(&[overlay_file], paz_total_len);

    let overlay_paz = overlay_dir.join("0.paz");
    let overlay_pamt = overlay_dir.join("0.pamt");

    fs::write(&overlay_paz, &paz_data)
        .map_err(|e| format!("Failed to write overlay PAZ: {}", e))?;

    update_pamt_paz_crc(&mut new_pamt, &paz_data);

    fs::write(&overlay_pamt, &new_pamt)
        .map_err(|e| format!("Failed to write overlay PAMT: {}", e))?;

    // Update PAPGT
    let pamt_header_crc = u32::from_le_bytes(new_pamt[0..4].try_into().unwrap());
    let papgt_path = Path::new(&game_path).join("meta").join("0.papgt");
    let papgt_backup = backup_path.join("papgt_clean.bin");

    if !papgt_backup.exists() && papgt_path.exists() {
        let _ = fs::copy(&papgt_path, &papgt_backup);
    }

    let clean_papgt = if papgt_backup.exists() {
        fs::read(&papgt_backup).map_err(|e| format!("Failed to read PAPGT backup: {}", e))?
    } else {
        fs::read(&papgt_path).map_err(|e| format!("Failed to read PAPGT: {}", e))?
    };

    let new_papgt = build_papgt_with_overlay(&clean_papgt, pamt_header_crc)?;
    fs::write(&papgt_path, &new_papgt)
        .map_err(|e| format!("Failed to write PAPGT: {}", e))?;

    Ok(FontReplaceResult {
        success: true,
        message: format!("Replaced {} ({} KB → {} KB)", bare_filename, rec.decomp_size / 1024, new_size / 1024),
    })
}

// =============================================================================
// Community Profiles (Feature 8)
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommunityProfileMod {
    pub title: String,
    pub version: String,
    pub file_name: String,
    pub nexus_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommunityProfile {
    pub name: String,
    pub author: String,
    pub description: String,
    pub created: String,
    pub mod_count: usize,
    pub mods: Vec<CommunityProfileMod>,
}

#[tauri::command]
pub fn export_community_profile(
    name: String,
    author: String,
    description: String,
    mods_path: String,
    active_mods: Vec<ActiveMod>,
    update_statuses: HashMap<String, ModUpdateStatus>,
) -> Result<String, String> {
    let mods_dir = Path::new(&mods_path);
    let mut profile_mods = Vec::new();

    for am in &active_mods {
        let mod_path = mods_dir.join(&am.file_name);
        if !mod_path.exists() {
            continue;
        }

        let mod_file = parse_mod_file(&mod_path)?;
        let (title, version, _author, _desc) = get_mod_display_info(&mod_file);

        let nexus_url = update_statuses.get(&am.file_name)
            .and_then(|s| s.nexus_url.clone());

        profile_mods.push(CommunityProfileMod {
            title,
            version,
            file_name: am.file_name.clone(),
            nexus_url,
        });
    }

    let profile = CommunityProfile {
        name: name.clone(),
        author,
        description,
        created: chrono::Local::now().to_rfc3339(),
        mod_count: profile_mods.len(),
        mods: profile_mods,
    };

    let content = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("Failed to serialize profile: {}", e))?;

    // Default save location next to the mods folder
    let default_dir = mods_dir.parent().unwrap_or(mods_dir);
    let default_path = default_dir.join(format!("{}.dmprofile", sanitize_filename(&name)));

    // Write to the default path (frontend handles the save dialog)
    fs::write(&default_path, content)
        .map_err(|e| format!("Failed to write profile: {}", e))?;

    Ok(default_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_community_profile(profile_path: String) -> Result<CommunityProfile, String> {
    let content = fs::read_to_string(&profile_path)
        .map_err(|e| format!("Failed to read profile file: {}", e))?;
    let profile: CommunityProfile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse profile file: {}", e))?;
    Ok(profile)
}

#[tauri::command]
pub fn restore_vanilla(game_path: String, backup_dir: String) -> Result<Vec<String>, String> {
    let game = Path::new(&game_path);
    let backup_path = Path::new(&backup_dir);
    let mut messages: Vec<String> = Vec::new();

    // 1. Rebuild PAPGT without 0036 entry
    let papgt_path = game.join("meta").join("0.papgt");
    if papgt_path.exists() {
        let data = fs::read(&papgt_path)
            .map_err(|e| format!("Failed to read PAPGT: {}", e))?;

        if data.len() >= 12 {
            let entry_count = data[8] as usize;
            let entries_start = 12;
            let entries_end = entries_start + entry_count * 12;

            if data.len() >= entries_end + 4 {
                let names_len = u32::from_le_bytes(
                    data[entries_end..entries_end + 4].try_into().unwrap_or([0; 4])
                ) as usize;
                let names_start = entries_end + 4;

                if data.len() >= names_start + names_len {
                    let names_block = &data[names_start..names_start + names_len];

                    // Find all entry name offsets and check which one is "0036"
                    let mut overlay_entry_idx: Option<usize> = None;
                    let mut overlay_name_offset: Option<u32> = None;

                    for i in 0..entry_count {
                        let entry_offset = entries_start + i * 12;
                        // Entry format: [IsOptional:1][LangType:2][Zero:1][NameOffset:4][PamtCrc:4]
                        let name_off = u32::from_le_bytes(
                            data[entry_offset + 4..entry_offset + 8].try_into().unwrap_or([0; 4])
                        ) as usize;

                        if name_off < names_len {
                            let end = names_block[name_off..].iter().position(|&b| b == 0).unwrap_or(names_len - name_off);
                            let name = &names_block[name_off..name_off + end];
                            if name == b"0036" {
                                overlay_entry_idx = Some(i);
                                overlay_name_offset = Some(name_off as u32);
                            }
                        }
                    }

                    if let (Some(entry_idx), Some(overlay_off)) = (overlay_entry_idx, overlay_name_offset) {
                        // Rebuild PAPGT without the 0036 entry AND its name string

                        // Find the length of "0036\0" in the names block
                        let overlay_name_len = {
                            let start = overlay_off as usize;
                            let end = names_block[start..].iter().position(|&b| b == 0).unwrap_or(names_len - start);
                            end + 1 // include the null terminator
                        };
                        let shift = overlay_name_len as u32;

                        // Build new names block without the overlay name
                        let mut new_names = Vec::with_capacity(names_len - overlay_name_len);
                        new_names.extend_from_slice(&names_block[..overlay_off as usize]);
                        new_names.extend_from_slice(&names_block[(overlay_off as usize + overlay_name_len)..]);

                        // Build new entries, skipping overlay, adjusting name offsets
                        let new_entry_count = entry_count - 1;
                        let mut new_data = Vec::new();

                        // Header: copy first 8 bytes, update entry count
                        new_data.extend_from_slice(&data[0..8]);
                        new_data.push(new_entry_count as u8);
                        new_data.extend_from_slice(&data[9..12]);

                        // Copy entries, skipping the overlay one, adjusting name offsets
                        for i in 0..entry_count {
                            if i == entry_idx { continue; }
                            let base = entries_start + i * 12;
                            let is_optional = data[base];
                            let lang_type = u16::from_le_bytes(data[base + 1..base + 3].try_into().unwrap());
                            let zero = data[base + 3];
                            let mut name_off = u32::from_le_bytes(data[base + 4..base + 8].try_into().unwrap());
                            let pamt_crc = u32::from_le_bytes(data[base + 8..base + 12].try_into().unwrap());

                            // Shift name offset if it was after the removed name
                            if name_off > overlay_off {
                                name_off -= shift;
                            }

                            new_data.push(is_optional);
                            new_data.extend_from_slice(&lang_type.to_le_bytes());
                            new_data.push(zero);
                            new_data.extend_from_slice(&name_off.to_le_bytes());
                            new_data.extend_from_slice(&pamt_crc.to_le_bytes());
                        }

                        // Write new names block length + data
                        new_data.extend_from_slice(&(new_names.len() as u32).to_le_bytes());
                        new_data.extend_from_slice(&new_names);

                        // Recompute header CRC
                        let header_crc = hashlittle(&new_data[12..], INTEGRITY_SEED);
                        new_data[0..4].copy_from_slice(&header_crc.to_le_bytes());

                        fs::write(&papgt_path, &new_data)
                            .map_err(|e| format!("Failed to write cleaned PAPGT: {}", e))?;

                        // Save as clean backup
                        fs::create_dir_all(&backup_path).ok();
                        let clean_backup = backup_path.join("papgt_clean.bin");
                        fs::write(&clean_backup, &new_data)
                            .map_err(|e| format!("Failed to save clean PAPGT backup: {}", e))?;

                        messages.push("PAPGT restored to vanilla (removed 0036 overlay entry)".to_string());
                    } else {
                        // No overlay found — already vanilla
                        let clean_backup = backup_path.join("papgt_clean.bin");
                        if !clean_backup.exists() {
                            fs::create_dir_all(&backup_path).ok();
                            fs::copy(&papgt_path, &clean_backup).ok();
                        }
                        messages.push("PAPGT is already vanilla".to_string());
                    }
                }
            }
        }
    }

    // 2. Delete overlay files in 0036/
    let overlay_dir = game.join("0036");
    if overlay_dir.exists() {
        let overlay_paz = overlay_dir.join("0.paz");
        let overlay_pamt = overlay_dir.join("0.pamt");
        if overlay_paz.exists() { fs::remove_file(&overlay_paz).ok(); }
        if overlay_pamt.exists() { fs::remove_file(&overlay_pamt).ok(); }
        fs::remove_dir(&overlay_dir).ok();
        messages.push("Removed overlay files (0036/)".to_string());
    }

    // 3. Backup PATHC if not already backed up, then it's already clean
    let pathc_path = game.join("meta").join("0.pathc");
    let pathc_backup = backup_path.join("pathc_clean.bin");
    if pathc_path.exists() && !pathc_backup.exists() {
        fs::create_dir_all(&backup_path).ok();
        fs::copy(&pathc_path, &pathc_backup).ok();
        messages.push("Backed up clean PATHC".to_string());
    }

    if messages.is_empty() {
        messages.push("Game appears to already be vanilla".to_string());
    }

    Ok(messages)
}

#[tauri::command]
pub fn download_and_apply_update(download_url: String) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;
    let exe_dir = exe.parent()
        .ok_or_else(|| "Failed to get exe directory".to_string())?;
    let new_exe = exe_dir.join("definitive-mod-manager.exe.update");

    // Download the new exe
    let response = reqwest::blocking::get(&download_url)
        .map_err(|e| format!("Download failed: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    let bytes = response.bytes()
        .map_err(|e| format!("Failed to read download: {}", e))?;
    fs::write(&new_exe, &bytes)
        .map_err(|e| format!("Failed to save update: {}", e))?;

    // Create a batch script to replace the exe after we exit
    let bat_path = exe_dir.join("_update.bat");
    let exe_str = exe.to_string_lossy();
    let new_exe_str = new_exe.to_string_lossy();
    let script = format!(
        "@echo off\r\n\
         timeout /t 2 /nobreak >nul\r\n\
         del \"{exe_str}\"\r\n\
         move \"{new_exe_str}\" \"{exe_str}\"\r\n\
         start \"\" \"{exe_str}\"\r\n\
         del \"%~f0\"\r\n"
    );
    fs::write(&bat_path, &script)
        .map_err(|e| format!("Failed to create update script: {}", e))?;

    // Launch the batch script detached
    std::process::Command::new("cmd")
        .args(["/C", "start", "/min", "", &bat_path.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {}", e))?;

    Ok(())
}
