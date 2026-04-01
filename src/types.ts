export interface ModChange {
  offset: number;
  label: string;
  original: string;
  patched: string;
}

export interface ModPatch {
  game_file: string;
  changes: ModChange[];
}

export interface ModInfo {
  title?: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
}

export interface ModFile {
  info: ModInfo;
  modinfo?: ModInfo;
  patches: ModPatch[];
}

export interface ActiveMod {
  fileName: string;
  disabledIndices: number[];
}

export interface AppConfig {
  gamePath: string;
  modsPath: string;
  activeMods: ActiveMod[];
  activeAsiMods: string[];
  activeLangMod: string | null;
  selectedLanguage: string;
  nexusApiKey: string;
}

export interface LangModEntry {
  file_name: string;
  title: string;
  language: string;
  author: string;
  description: string;
  active: boolean;
}

export interface ModEntry {
  file_name: string;
  title: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  patch_count: number;
  game_files: string[];
  has_conflicts: boolean;
}

export interface ConflictInfo {
  offset: number;
  game_file: string;
  mods: string[];
  labels: string[];
}

export interface ApplyResult {
  success: boolean;
  applied: string[];
  errors: string[];
  backup_created: boolean;
}

export interface PapgtStatus {
  exists: boolean;
  has_overlay: boolean;
  overlay_groups: string[];
  total_groups: number;
}

export interface InitResult {
  success: boolean;
  mods_dir_created: boolean;
  backups_created: boolean;
  messages: string[];
}

export interface ModProfile {
  name: string;
  created: string;
  activeMods: ActiveMod[];
  activeLangMod: string | null;
  selectedLanguage: string;
}

export interface GameVersion {
  paver_hex: string;
  exe_size: number;
  exe_modified: string;
}

export interface NexusFolder {
  folder_name: string;
  mod_name: string;
  has_json: boolean;
  has_readme: boolean;
}

export interface BackupInfo {
  file_name: string;
  game_file: string;
  size: number;
  created: string;
}

export interface PreflightResult {
  passed: boolean;
  checks: PreflightCheck[];
}

export interface PreflightCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface RecoverResult {
  was_interrupted: boolean;
  files_restored: string[];
  errors: string[];
  message: string;
}

export interface DetailedCheckResult {
  timestamp: string;
  game_dir_ok: boolean;
  interrupted_apply: boolean;
  version_mismatch: boolean;
  current_version: string;
  saved_version: string;
  conflicts: ConflictInfo[];
  can_apply: boolean;
  stale_backup: boolean;
  mod_file_issues: string[];
  total_patches: number;
  target_files: string[];
}

export interface NexusModInfo {
  mod_id: number;
  name: string;
  version: string;
  summary: string;
  author: string;
  updated_timestamp: number;
  nexus_url: string;
}

export interface NexusIdMapping {
  file_name: string;
  nexus_mod_id: number;
  folder_name: string;
}

export interface ModUpdateStatus {
  file_name: string;
  nexus_mod_id: number | null;
  local_version: string;
  nexus_version: string | null;
  is_outdated: boolean;
  nexus_url: string | null;
  error: string | null;
}

export interface NexusCacheEntry {
  file_name: string;
  nexus_mod_id: number;
  nexus_name: string;
  last_checked: string;
}

export interface ReshadePreset {
  name: string;
  file_name: string;
  is_active: boolean;
}

export interface ReshadeStatus {
  installed: boolean;
  enabled: boolean;
  dll_name: string | null;
  has_config: boolean;
  active_preset: string | null;
  presets: ReshadePreset[];
  shader_count: number;
}

export interface AsiPlugin {
  name: string;
  file_name: string;
  enabled: boolean;
  has_ini: boolean;
  ini_path: string | null;
}

export interface AsiStatus {
  has_loader: boolean;
  loader_name: string | null;
  plugins: AsiPlugin[];
}

// Mod Packs
export interface ModPack {
  name: string;
  description: string;
  author: string;
  created: string;
  version: string;
  mods: ModPackEntry[];
}

export interface ModPackEntry {
  file_name: string;
  title: string;
  version: string;
  disabled_indices: number[];
  mod_data: string | null;
}

// Backup Snapshots
export interface Snapshot {
  name: string;
  created: string;
  mod_count: number;
  description: string;
}

// Compatibility Matrix
export interface CompatConflict {
  game_file: string;
  offset: number;
  label_a: string;
  label_b: string;
}

export interface CompatEntry {
  mod_a: string;
  mod_b: string;
  conflicts: CompatConflict[];
  compatible: boolean;
}

// Mod Creator
export interface NewModData {
  name: string;
  version: string;
  author: string;
  description: string;
  patches: NewPatch[];
}

export interface NewPatch {
  game_file: string;
  changes: NewChange[];
}

export interface NewChange {
  offset: number;
  label: string;
  original: string;
  patched: string;
}


// Texture Mods
export interface TextureModEntry {
  folder_name: string;
  name: string;
  dds_count: number;
}

export interface TextureApplyResult {
  success: boolean;
  textures_applied: number;
  errors: string[];
}

// Crimson Browser Mods
export interface BrowserModEntry {
  folder_name: string;
  title: string;
  author: string;
  version: string;
  description: string;
  file_count: number;
  enabled: boolean;
  mod_type: string;
}

// Font Replacement
export interface GameFontEntry {
  filename: string;
  path: string;
  group: string;
  language: string;
  orig_size: number;
}

export interface FontReplaceResult {
  success: boolean;
  message: string;
}

// Community Profiles
export interface CommunityProfileMod {
  title: string;
  version: string;
  file_name: string;
  nexus_url: string | null;
}

export interface CommunityProfile {
  name: string;
  author: string;
  description: string;
  created: string;
  mod_count: number;
  mods: CommunityProfileMod[];
}
