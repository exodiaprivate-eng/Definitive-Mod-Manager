import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Toaster, toast } from "sonner";
import { Titlebar } from "@/components/Titlebar";
import { Sidebar, type View } from "@/components/Sidebar";
import { ModList } from "@/components/ModList";
import { ConflictView } from "@/components/ConflictView";
import { LanguageView } from "@/components/LanguageView";
import { SettingsView } from "@/components/SettingsView";
import { AboutView } from "@/components/AboutView";
import { ProfileManager } from "@/components/ProfileManager";
import { BackupManager } from "@/components/BackupManager";
import { AsiModView } from "@/components/AsiModView";
import { ReshadeView } from "@/components/ReshadeView";
import { PreflightDialog } from "@/components/PreflightDialog";
import { CheckResultDialog } from "@/components/CheckResultDialog";
import { LogPanel, type LogEntry } from "@/components/LogPanel";
import { StatusBar } from "@/components/StatusBar";
import type { AppConfig, ModEntry, ConflictInfo, ActiveMod, ApplyResult, LangModEntry, PapgtStatus, ModProfile, BackupInfo, GameVersion, PreflightResult, RecoverResult, DetailedCheckResult, ModChange, NexusIdMapping, ModUpdateStatus, NexusCacheEntry, AsiStatus, ReshadeStatus } from "@/types";

interface PatchDetail {
  game_file: string;
  changes: ModChange[];
}

const NEXUS_API_KEY = "";

const DEFAULT_CONFIG: AppConfig = {
  gamePath: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crimson Desert",
  modsPath: "",
  activeMods: [],
  activeAsiMods: [],
  activeLangMod: null,
  selectedLanguage: "english",
  nexusApiKey: "",
};

export default function App() {
  const [view, setView] = useState<View>("mods");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [configPath, setConfigPath] = useState("");
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [langMods, setLangMods] = useState<LangModEntry[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [gamePathValid, setGamePathValid] = useState(false);
  const [applying, setApplying] = useState(false);
  const [, setLoaded] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [papgtStatus, setPapgtStatus] = useState<PapgtStatus | null>(null);
  const [profiles, setProfiles] = useState<ModProfile[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [gameVersion, setGameVersion] = useState<GameVersion | null>(null);
  const [lastKnownVersion, setLastKnownVersion] = useState<string | null>(null);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [showPreflight, setShowPreflight] = useState(false);
  const [modDetails, setModDetails] = useState<Record<string, PatchDetail[]>>({});
  const [mountedMods, setMountedMods] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [checkResult, setCheckResult] = useState<DetailedCheckResult | null>(null);
  const [showCheckResult, setShowCheckResult] = useState(false);
  const [updateStatuses, setUpdateStatuses] = useState<Record<string, ModUpdateStatus>>({});
  const [, setNexusIdMappings] = useState<NexusIdMapping[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [asiStatus, setAsiStatus] = useState<AsiStatus | null>(null);
  const [installingLoader, setInstallingLoader] = useState(false);
  const [reshadeStatus, setReshadeStatus] = useState<ReshadeStatus | null>(null);

  const addLog = useCallback((message: string, level: LogEntry["level"] = "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-US", { hour12: false }) + "." + String(now.getMilliseconds()).padStart(3, "0");
    setLogs((prev) => [...prev, { timestamp, message, level }]);
  }, []);

  function clearLogs() {
    setLogs([]);
  }

  async function scanAsiMods() {
    try {
      const status = await invoke<AsiStatus>("scan_asi_mods", { gamePath: config.gamePath });
      setAsiStatus(status);
      const count = status.plugins.length;
      if (count > 0) {
        addLog(`ASI scan: ${count} plugin(s) found${status.has_loader ? `, loader: ${status.loader_name}` : ", no loader detected"}`, "info");
      }
    } catch (e) {
      setAsiStatus(null);
      addLog(`ASI scan failed: ${e}`, "error");
    }
  }

  async function scanReshade() {
    try {
      const status = await invoke<ReshadeStatus>("scan_reshade", { gamePath: config.gamePath });
      setReshadeStatus(status);
      if (status.installed) {
        addLog(`ReShade: ${status.enabled ? "enabled" : "disabled"} via ${status.dll_name}, ${status.shader_count} shader(s), ${status.presets.length} preset(s)`, "info");
      }
    } catch (e) {
      setReshadeStatus(null);
      addLog(`ReShade scan failed: ${e}`, "error");
    }
  }

  async function scanPapgt() {
    try {
      const status = await invoke<PapgtStatus>("get_papgt_status", { gamePath: config.gamePath });
      setPapgtStatus(status);
      if (status.exists) {
        if (status.has_overlay) {
          addLog(`papgt: overlay active (${status.overlay_groups.length}/${status.total_groups} groups)`, "info");
        } else {
          addLog(`papgt: found, no overlay (${status.total_groups} groups)`, "info");
        }
      } else {
        addLog("papgt: not found in game directory", "warning");
      }
    } catch (e) {
      setPapgtStatus(null);
      addLog(`papgt scan failed: ${e}`, "error");
    }
  }

  useEffect(() => {
    async function init() {
      addLog("Definitive Mod Manager v1.0.0 loaded", "success");

      // Determine app directory dynamically from exe location
      let appDir = "";
      try {
        appDir = await invoke<string>("get_app_dir");
      } catch {
        appDir = ".";
      }
      const myConfigPath = appDir + "\\config.json";
      const myModsPath = appDir + "\\mods";

      // Auto-detect game path
      let detectedPath = "";
      try {
        detectedPath = await invoke<string>("auto_detect_game_path") || "";
        if (detectedPath) {
          addLog(`Auto-detected game path: ${detectedPath}`, "info");
        }
      } catch {
        addLog("Game path auto-detection not available", "info");
      }

      // Initialize app directories and backups
      try {
        const initResult = await invoke<{ success: boolean; mods_dir_created: boolean; backups_created: boolean; messages: string[] }>("initialize_app", {
          gamePath: detectedPath,
          appDir,
        });
        for (const msg of initResult.messages) {
          addLog(msg, initResult.backups_created ? "success" : "info");
        }
      } catch (e) {
        addLog(`Initialization warning: ${e}`, "warning");
      }

      // Try loading existing config
      let configLoaded = false;
      try {
        const cfg = await invoke<AppConfig>("load_config", { configPath: myConfigPath });
        // Fill in missing fields from defaults/detection
        if (!cfg.gamePath && detectedPath) {
          cfg.gamePath = detectedPath;
        }
        if (!cfg.modsPath) {
          cfg.modsPath = myModsPath;
        }
        if (!cfg.nexusApiKey) {
          cfg.nexusApiKey = NEXUS_API_KEY;
        }
        setConfig(cfg);
        setConfigPath(myConfigPath);
        configLoaded = true;
        addLog("Config loaded — restoring last session state", "info");
      } catch {
        // Config doesn't exist yet — first startup
      }

      if (!configLoaded) {
        // First startup: create config with defaults
        const newConfig: AppConfig = {
          ...DEFAULT_CONFIG,
          gamePath: detectedPath || DEFAULT_CONFIG.gamePath,
          modsPath: myModsPath,
          nexusApiKey: NEXUS_API_KEY,
        };
        setConfig(newConfig);
        setConfigPath(myConfigPath);

        // Save the initial config
        try {
          await invoke("save_config", { configPath: myConfigPath, config: newConfig });
          addLog("Created initial config file", "success");
        } catch (e) {
          addLog(`Warning: could not save config: ${e}`, "warning");
        }
      }

      setLoaded(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (!config.modsPath) return;
    scanMods();
    scanLangMods();
    loadProfiles();
    loadBackups();
    parseNexusIds();
  }, [config.modsPath, config.activeMods, config.activeLangMod]);

  // Drag-and-drop: listen for files dropped onto the window
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type === "over") {
        setDragOver(true);
      } else {
        // Clear overlay on drop, leave, cancel, or any other event
        setDragOver(false);

        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (!config.modsPath || paths.length === 0) return;

          let imported = 0;
          for (const filePath of paths) {
            const ext = filePath.split(".").pop()?.toLowerCase();
            if (ext === "json" || ext === "zip") {
              try {
                if (ext === "zip") {
                  await invoke("import_archive", { archivePath: filePath, modsPath: config.modsPath });
                } else {
                  await invoke("import_mod", { sourcePath: filePath, modsPath: config.modsPath });
                }
                imported++;
                addLog(`Imported: ${filePath.split(/[\\/]/).pop()}`, "success");
              } catch (e) {
                addLog(`Import failed: ${filePath.split(/[\\/]/).pop()} — ${e}`, "error");
              }
            }
          }
          if (imported > 0) {
            toast.success(`Imported ${imported} mod(s)`);
            scanMods();
          } else {
            toast.warning("No valid mod files found (expected .json or .zip)");
          }
        }
      }
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [config.modsPath]);

  // Auto-refresh: poll for new/removed mods every 3 seconds
  useEffect(() => {
    if (!config.modsPath) return;

    const interval = setInterval(() => {
      // Silent re-scan (no logging)
      invoke<ModEntry[]>("scan_mods", {
        modsPath: config.modsPath,
        activeMods: config.activeMods,
      }).then((entries) => {
        // Only update if the count changed (avoid unnecessary re-renders)
        setMods((prev) => {
          if (prev.length !== entries.length) return entries;
          // Check if any file names changed
          const prevNames = prev.map(m => m.file_name).sort().join(",");
          const newNames = entries.map(m => m.file_name).sort().join(",");
          if (prevNames !== newNames) return entries;
          return prev;
        });
      }).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [config.modsPath, config.activeMods]);

  useEffect(() => {
    if (!config.gamePath) return;
    invoke<boolean>("validate_game_path", { gamePath: config.gamePath })
      .then((valid) => {
        setGamePathValid(valid);
      })
      .catch(() => setGamePathValid(false));
    scanPapgt();
    scanAsiMods();
    scanReshade();
    checkGameVersion();
  }, [config.gamePath]);

  useEffect(() => {
    if (!config.modsPath) return;
    const activeFileNames = config.activeMods.map((m) => m.fileName);
    if (activeFileNames.length < 2) {
      setConflicts([]);
      return;
    }
    invoke<ConflictInfo[]>("check_conflicts", {
      modsPath: config.modsPath,
      activeMods: activeFileNames,
    })
      .then(setConflicts)
      .catch(() => setConflicts([]));
  }, [config.activeMods, config.modsPath]);

  async function scanMods() {
    try {
      const entries = await invoke<ModEntry[]>("scan_mods", {
        modsPath: config.modsPath,
        activeMods: config.activeMods,
      });
      setMods(entries);
    } catch (e) {
      console.error("Failed to scan mods:", e);
    }
  }

  async function scanLangMods() {
    try {
      const entries = await invoke<LangModEntry[]>("scan_lang_mods", {
        modsPath: config.modsPath,
        activeLangMod: config.activeLangMod,
      });
      setLangMods(entries);
    } catch (e) {
      console.error("Failed to scan lang mods:", e);
    }
  }

  async function loadProfiles() {
    try {
      const profilesDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\profiles";
      const result = await invoke<ModProfile[]>("list_profiles", { profilesDir });
      setProfiles(result);
    } catch (e) {
      console.error("Failed to load profiles:", e);
    }
  }

  async function saveProfile(name: string) {
    try {
      const profilesDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\profiles";
      await invoke("save_profile", {
        profilesDir,
        name,
        activeMods: config.activeMods,
        activeLangMod: config.activeLangMod,
        selectedLanguage: config.selectedLanguage,
      });
      addLog(`Profile saved: ${name}`, "success");
      toast.success(`Profile "${name}" saved`);
      loadProfiles();
    } catch (e) {
      addLog(`Failed to save profile: ${e}`, "error");
      toast.error(`Failed to save profile: ${e}`);
    }
  }

  async function loadProfileConfig(name: string) {
    try {
      const profilesDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\profiles";
      const profile = await invoke<ModProfile>("load_profile", { profilesDir, name });
      const newConfig: AppConfig = {
        ...config,
        activeMods: profile.active_mods,
        activeLangMod: profile.active_lang_mod,
        selectedLanguage: profile.selected_language,
      };
      await saveConfig(newConfig);
      addLog(`Profile loaded: ${name} (${profile.active_mods.length} mods)`, "success");
      toast.success(`Profile "${name}" loaded`);
    } catch (e) {
      addLog(`Failed to load profile: ${e}`, "error");
      toast.error(`Failed to load profile: ${e}`);
    }
  }

  async function deleteProfile(name: string) {
    try {
      const profilesDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\profiles";
      await invoke("delete_profile", { profilesDir, name });
      addLog(`Profile deleted: ${name}`, "info");
      toast.success(`Profile "${name}" deleted`);
      loadProfiles();
    } catch (e) {
      addLog(`Failed to delete profile: ${e}`, "error");
      toast.error(`Failed to delete profile: ${e}`);
    }
  }

  async function loadBackups() {
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const result = await invoke<BackupInfo[]>("list_backups", { backupDir });
      setBackups(result);
    } catch (e) {
      console.error("Failed to load backups:", e);
    }
  }

  async function restoreSingleBackup(fileName: string) {
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const result = await invoke<string>("restore_single_backup", {
        gamePath: config.gamePath,
        backupDir,
        fileName,
      });
      addLog(`Backup restored: ${result}`, "success");
      toast.success(`Restored backup: ${fileName}`);
      loadBackups();
    } catch (e) {
      addLog(`Failed to restore backup: ${e}`, "error");
      toast.error(`Failed to restore backup: ${e}`);
    }
  }

  async function deleteBackup(fileName: string) {
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      await invoke("delete_backup", { backupDir, fileName });
      addLog(`Backup deleted: ${fileName}`, "info");
      toast.success(`Backup deleted: ${fileName}`);
      loadBackups();
    } catch (e) {
      addLog(`Failed to delete backup: ${e}`, "error");
      toast.error(`Failed to delete backup: ${e}`);
    }
  }

  // @ts-ignore - available for future UI wiring
  async function exportModList() {
    try {
      const selected = await save({
        title: "Export Mod List",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      await invoke("export_mod_list", {
        exportPath: selected,
        activeMods: config.activeMods,
        activeLangMod: config.activeLangMod,
        selectedLanguage: config.selectedLanguage,
      });
      addLog(`Mod list exported to ${selected}`, "success");
      toast.success("Mod list exported");
    } catch (e) {
      addLog(`Failed to export mod list: ${e}`, "error");
      toast.error(`Failed to export: ${e}`);
    }
  }

  // @ts-ignore - available for future UI wiring
  async function importModList() {
    try {
      const selected = await open({
        title: "Import Mod List",
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!selected) return;

      const filePath = selected as string;
      const imported = await invoke<{ active_mods: ActiveMod[]; active_lang_mod: string | null; selected_language: string }>("import_mod_list", {
        importPath: filePath,
      });
      const newConfig: AppConfig = {
        ...config,
        activeMods: imported.active_mods,
        activeLangMod: imported.active_lang_mod,
        selectedLanguage: imported.selected_language,
      };
      await saveConfig(newConfig);
      addLog(`Mod list imported from ${filePath}`, "success");
      toast.success("Mod list imported");
    } catch (e) {
      addLog(`Failed to import mod list: ${e}`, "error");
      toast.error(`Failed to import: ${e}`);
    }
  }

  async function runPreflight(): Promise<PreflightResult | null> {
    setPreflightChecking(true);
    setShowPreflight(true);
    setPreflightResult(null);
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const result = await invoke<PreflightResult>("preflight_check", {
        gamePath: config.gamePath,
        modsPath: config.modsPath,
        activeMods: config.activeMods,
        backupDir,
      });
      setPreflightResult(result);
      if (result.passed) {
        addLog("Pre-flight check passed", "success");
      } else {
        addLog("Pre-flight check failed", "warning");
        result.checks.filter((c) => !c.passed).forEach((c) => addLog(`  Failed: ${c.name} — ${c.message}`, "error"));
      }
      return result;
    } catch (e) {
      addLog(`Pre-flight check error: ${e}`, "error");
      toast.error(`Pre-flight check failed: ${e}`);
      setShowPreflight(false);
      return null;
    } finally {
      setPreflightChecking(false);
    }
  }

  async function checkGameVersion() {
    try {
      const version = await invoke<GameVersion>("get_game_version", { gamePath: config.gamePath });
      setGameVersion(version);
      if (lastKnownVersion && lastKnownVersion !== version.paver_hex) {
        addLog(`Game version changed: ${lastKnownVersion} -> ${version.paver_hex}`, "warning");
      }
      setLastKnownVersion(version.paver_hex);
    } catch (e) {
      console.error("Failed to check game version:", e);
    }
  }

  async function recoverInterrupted() {
    addLog("Running recovery check...", "info");
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const result = await invoke<RecoverResult>("recover_interrupted", {
        gamePath: config.gamePath,
        backupDir,
      });
      addLog(`Recovery: was_interrupted=${result.was_interrupted}`, "info");
      if (result.files_restored.length > 0) {
        result.files_restored.forEach((f) => addLog(`  Restored: ${f}`, "success"));
      }
      if (result.errors.length > 0) {
        result.errors.forEach((e) => addLog(`  Error: ${e}`, "error"));
      }
      addLog(`Recovery result: ${result.message}`, result.was_interrupted ? "warning" : "info");
      toast[result.was_interrupted ? "warning" : "success"](result.message);
    } catch (e) {
      addLog(`Recovery failed: ${e}`, "error");
      toast.error(`Recovery failed: ${e}`);
    }
  }

  async function runDetailedCheck() {
    addLog("Running detailed check...", "info");
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const result = await invoke<DetailedCheckResult>("detailed_check", {
        gamePath: config.gamePath,
        modsPath: config.modsPath,
        activeMods: config.activeMods,
        backupDir,
      });
      setCheckResult(result);
      setShowCheckResult(true);

      addLog(`Detailed check @ ${result.timestamp}`, "info");
      addLog(`  Game dir OK: ${result.game_dir_ok}`, result.game_dir_ok ? "success" : "error");
      addLog(`  Interrupted apply: ${result.interrupted_apply}`, result.interrupted_apply ? "warning" : "info");
      addLog(`  Version mismatch: ${result.version_mismatch}`, result.version_mismatch ? "warning" : "info");
      addLog(`  Current version: ${result.current_version}`, "info");
      addLog(`  Saved version: ${result.saved_version}`, "info");
      addLog(`  Stale backup: ${result.stale_backup}`, result.stale_backup ? "warning" : "info");
      addLog(`  Conflicts: ${result.conflicts.length}`, result.conflicts.length > 0 ? "warning" : "info");
      addLog(`  Mod file issues: ${result.mod_file_issues.length}`, result.mod_file_issues.length > 0 ? "error" : "info");
      addLog(`  Total patches: ${result.total_patches}`, "info");
      addLog(`  Target files: ${result.target_files.length}`, "info");
      addLog(`  Can apply: ${result.can_apply}`, result.can_apply ? "success" : "error");

      if (result.mod_file_issues.length > 0) {
        result.mod_file_issues.forEach((issue) => addLog(`    Issue: ${issue}`, "error"));
      }
    } catch (e) {
      addLog(`Detailed check failed: ${e}`, "error");
      toast.error(`Detailed check failed: ${e}`);
    }
  }

  async function parseNexusIds() {
    if (!config.modsPath) return;
    try {
      const mappings = await invoke<NexusIdMapping[]>("parse_nexus_mod_ids", {
        modsPath: config.modsPath,
      });
      setNexusIdMappings(mappings);
      if (mappings.length > 0) {
        addLog(`Detected ${mappings.length} Nexus mod ID(s)`, "info");
      }
    } catch (e) {
      console.error("Failed to parse Nexus mod IDs:", e);
    }
  }

  async function checkForUpdates() {
    const apiKey = config.nexusApiKey || NEXUS_API_KEY;
    if (!apiKey) {
      toast.error("No Nexus Mods API key available.");
      return;
    }
    setCheckingUpdates(true);
    addLog("Checking for mod updates via Nexus Mods...", "info");

    try {
      // 1. Get folder-based IDs
      let mappings = await invoke<NexusIdMapping[]>("parse_nexus_mod_ids", {
        modsPath: config.modsPath,
      });
      setNexusIdMappings(mappings);

      if (mappings.length > 0) {
        addLog(`Found ${mappings.length} folder-based Nexus mod mapping(s)`, "info");
      }

      // 2. Load cached search results
      try {
        const cache = await invoke<NexusCacheEntry[]>("load_nexus_cache", {
          modsPath: config.modsPath,
        });

        // 3. Add cached entries as mappings (if not already present)
        for (const entry of cache) {
          if (!mappings.some((m) => m.file_name === entry.file_name)) {
            mappings.push({
              file_name: entry.file_name,
              nexus_mod_id: entry.nexus_mod_id,
              folder_name: "",
            });
            addLog(`Cache hit: ${entry.file_name} -> Nexus #${entry.nexus_mod_id} (${entry.nexus_name})`, "info");
          }
        }
      } catch (e) {
        addLog(`Failed to load Nexus cache: ${e}`, "warning");
      }

      // 4. Find mods still without mappings
      const unmappedMods = mods.filter(
        (m) => !mappings.some((map) => map.file_name === m.file_name)
      );

      // 5. Search Nexus for unmapped mods by name
      if (unmappedMods.length > 0) {
        addLog(`Searching Nexus for ${unmappedMods.length} unmatched mod(s)...`, "info");
        try {
          const newMappings = await invoke<NexusIdMapping[]>("search_all_unmatched_mods", {
            apiKey,
            modsPath: config.modsPath,
            knownMappings: mappings,
          });
          for (const nm of newMappings) {
            addLog(`Search found: ${nm.file_name} -> Nexus #${nm.nexus_mod_id}`, "success");
          }
          if (newMappings.length > 0) {
            addLog(`Name search found ${newMappings.length} new mapping(s)`, "info");
          } else if (unmappedMods.length > 0) {
            addLog(`No Nexus matches found for ${unmappedMods.length} mod(s)`, "info");
          }
          mappings = [...mappings, ...newMappings];
        } catch (e) {
          addLog(`Nexus name search failed: ${e}`, "warning");
        }
      }

      setNexusIdMappings(mappings);

      if (mappings.length === 0) {
        addLog("No Nexus mod mappings found (folder-based or name search).", "warning");
        toast.warning("No Nexus mod mappings found");
        setCheckingUpdates(false);
        return;
      }

      addLog(`Checking updates for ${mappings.length} mapped mod(s)...`, "info");

      // 6. Check all mappings for updates
      const statuses = await invoke<ModUpdateStatus[]>("check_mod_updates", {
        apiKey,
        modIds: mappings,
        modsPath: config.modsPath,
      });

      const statusMap: Record<string, ModUpdateStatus> = {};
      let outdatedCount = 0;
      let errorCount = 0;

      // Add statuses from Nexus-checked mods
      for (const status of statuses) {
        statusMap[status.file_name] = status;
        if (status.is_outdated) {
          outdatedCount++;
          addLog(`Update available: ${status.file_name} (local: ${status.local_version} -> nexus: ${status.nexus_version})`, "warning");
        } else if (status.error) {
          errorCount++;
          addLog(`Update check error for ${status.file_name}: ${status.error}`, "error");
        } else {
          addLog(`Up to date: ${status.file_name} (v${status.local_version})`, "success");
        }
      }

      // Mark all other mods as "up to date" (no Nexus ID to check against)
      for (const mod of mods) {
        if (!statusMap[mod.file_name]) {
          statusMap[mod.file_name] = {
            file_name: mod.file_name,
            nexus_mod_id: null,
            local_version: mod.version,
            nexus_version: null,
            is_outdated: false,
            nexus_url: null,
            error: null,
          };
        }
      }

      setUpdateStatuses(statusMap);

      if (outdatedCount > 0) {
        toast.warning(`${outdatedCount} mod(s) have updates available`);
      } else if (errorCount > 0) {
        toast.warning(`Update check complete with ${errorCount} error(s)`);
      } else {
        toast.success("All mods are up to date");
      }
    } catch (e) {
      addLog(`Update check failed: ${e}`, "error");
      toast.error(`Update check failed: ${e}`);
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function loadModDetails(fileName: string) {
    if (modDetails[fileName]) return; // Already loaded
    try {
      const modFile = await invoke<{ patches: PatchDetail[] }>("get_mod_details", {
        modsPath: config.modsPath,
        fileName,
      });
      setModDetails((prev) => ({ ...prev, [fileName]: modFile.patches }));
    } catch (e) {
      console.error("Failed to load mod details:", e);
    }
  }

  function togglePatch(fileName: string, patchIndex: number) {
    const existing = config.activeMods.find((m) => m.fileName === fileName);
    if (!existing) return; // Mod must be active to toggle patches

    const newDisabled = existing.disabledIndices.includes(patchIndex)
      ? existing.disabledIndices.filter((i) => i !== patchIndex)
      : [...existing.disabledIndices, patchIndex];

    const newActive = config.activeMods.map((m) =>
      m.fileName === fileName ? { ...m, disabledIndices: newDisabled } : m
    );
    saveConfig({ ...config, activeMods: newActive });
  }

  async function saveConfig(newConfig: AppConfig) {
    setConfig(newConfig);
    if (configPath) {
      try {
        await invoke("save_config", { configPath, config: newConfig });
      } catch (e) {
        toast.error(`Failed to save config: ${e}`);
      }
    }
  }

  async function deleteMod(fileName: string) {
    try {
      // Remove from active mods first
      const newActive = config.activeMods.filter((m) => m.fileName !== fileName);
      await saveConfig({ ...config, activeMods: newActive });

      // Delete the file
      await invoke("delete_mod", { modsPath: config.modsPath, fileName });
      toast.success(`Deleted ${fileName}`);
      addLog(`Deleted mod: ${fileName}`, "success");
      scanMods();
    } catch (e) {
      toast.error(`Failed to delete: ${e}`);
      addLog(`Delete failed: ${fileName} — ${e}`, "error");
    }
  }

  function toggleMod(fileName: string) {
    const isActive = config.activeMods.some((m) => m.fileName === fileName);
    let newActive: ActiveMod[];
    if (isActive) {
      newActive = config.activeMods.filter((m) => m.fileName !== fileName);
    } else {
      newActive = [...config.activeMods, { fileName, disabledIndices: [] }];
    }
    saveConfig({ ...config, activeMods: newActive });
  }

  function reorderMods(startIndex: number, endIndex: number) {
    const reordered = [...mods];
    const [moved] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, moved);
    setMods(reordered);

    const newActive = reordered
      .filter((m) => m.enabled)
      .map((m) => {
        const existing = config.activeMods.find((a) => a.fileName === m.file_name);
        return existing || { fileName: m.file_name, disabledIndices: [] };
      });
    saveConfig({ ...config, activeMods: newActive });
  }

  function enableAll() {
    const newActive = mods.map((m) => ({
      fileName: m.file_name,
      disabledIndices: [] as number[],
    }));
    saveConfig({ ...config, activeMods: newActive });
    toast.success(`Enabled all ${mods.length} mods`);
  }

  function disableAll() {
    saveConfig({ ...config, activeMods: [] });
    toast.success("Disabled all mods");
  }

  function activateLangMod(fileName: string | null) {
    const language = fileName
      ? langMods.find((m) => m.file_name === fileName)?.language || "english"
      : "english";
    saveConfig({
      ...config,
      activeLangMod: fileName,
      selectedLanguage: language,
    });
    toast.success(fileName ? `Language mod activated` : "Reverted to default language");
  }

  async function applyMods() {
    if (!gamePathValid) {
      toast.error("Invalid game path. Check Settings.");
      addLog("Mount failed: invalid game path", "error");
      return;
    }

    // Run preflight check first
    const preflight = await runPreflight();
    if (!preflight) return;

    if (preflight.passed) {
      // Auto-proceed if all checks pass
      setShowPreflight(false);
      await doMount();
    }
    // If preflight failed, dialog stays open — user must cancel or wait
  }

  async function doMount() {
    setApplying(true);
    addLog("Mounting mods...", "info");
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";

      // Build the full list of mods to apply (gameplay + language)
      let allActiveMods = [...config.activeMods];
      if (config.activeLangMod) {
        allActiveMods.push({
          fileName: "_lang\\" + config.activeLangMod,
          disabledIndices: [],
        });
      }

      const result = await invoke<ApplyResult>("apply_mods", {
        gamePath: config.gamePath,
        modsPath: config.modsPath,
        activeMods: allActiveMods,
        backupDir,
      });

      if (result.success) {
        toast.success(`Mounted ${result.applied.length} mod(s) successfully`);
        addLog(`Mount successful: ${result.applied.length} mod(s) applied`, "success");
        result.applied.forEach((mod) => addLog(`  Mounted: ${mod}`, "success"));
        // Track which mods are currently mounted
        setMountedMods(config.activeMods.map((m) => m.fileName));
        if (result.backup_created) {
          addLog("Backup created for original files", "info");
        }
      } else {
        toast.warning(
          `Mounted with ${result.errors.length} error(s): ${result.errors[0]}`
        );
        addLog(`Mount completed with ${result.errors.length} error(s)`, "warning");
        result.errors.forEach((err) => addLog(`  Error: ${err}`, "error"));
      }

      // Refresh status after mount
      loadBackups();
      scanPapgt();
    } catch (e) {
      toast.error(`Failed to mount mods: ${e}`);
      addLog(`Mount failed: ${e}`, "error");
    } finally {
      setApplying(false);
    }
  }

  async function revertMods() {
    addLog("Unmounting mods...", "info");
    try {
      const backupDir = config.modsPath.replace(/[\\/]mods$/, "") + "\\backups";
      const restored = await invoke<string[]>("revert_mods", {
        gamePath: config.gamePath,
        backupDir,
      });
      toast.success(`Unmounted — reverted ${restored.length} file(s) to original`);
      addLog(`Unmount successful: ${restored.length} file(s) restored`, "success");
      restored.forEach((file) => addLog(`  Restored: ${file}`, "success"));
      setMountedMods([]);
      scanPapgt();
    } catch (e) {
      toast.error(`Failed to unmount: ${e}`);
      addLog(`Unmount failed: ${e}`, "error");
    }
  }

  async function startGame() {
    addLog("Launching game...", "info");
    try {
      await invoke("launch_game", { gamePath: config.gamePath });
      addLog("Game launched successfully", "success");
      toast.success("Game launched");
    } catch (e) {
      addLog(`Failed to launch game: ${e}`, "error");
      toast.error(`Failed to launch game: ${e}`);
    }
  }

  async function importMod() {
    const selected = await open({
      title: "Import Mod",
      filters: [
        { name: "Mod Files", extensions: ["json", "zip"] },
        { name: "JSON Mod", extensions: ["json"] },
        { name: "ZIP Archive", extensions: ["zip"] },
      ],
      multiple: false,
    });
    if (!selected) return;

    const filePath = selected as string;
    const isArchive = filePath.toLowerCase().endsWith(".zip");

    try {
      if (isArchive) {
        const imported = await invoke<string[]>("import_archive", {
          archivePath: filePath,
          modsPath: config.modsPath,
        });
        toast.success(`Imported ${imported.length} file(s) from archive`);
      } else {
        const entry = await invoke<ModEntry>("import_mod", {
          sourcePath: filePath,
          modsPath: config.modsPath,
        });
        toast.success(`Imported "${entry.title}"`);
      }
      scanMods();
    } catch (e) {
      toast.error(`Import failed: ${e}`);
    }
  }

  async function importLangMod() {
    const selected = await open({
      title: "Import Language Mod",
      filters: [{ name: "JSON Language Mod", extensions: ["json"] }],
      multiple: false,
    });
    if (!selected) return;

    try {
      const source = selected as string;
      const fileName = source.split(/[\\/]/).pop() || "";
      const langDir = config.modsPath + "\\_lang";

      // Ensure _lang directory exists
      await invoke("import_mod", {
        sourcePath: source,
        modsPath: langDir,
      });
      toast.success(`Imported language mod "${fileName}"`);
      scanLangMods();
    } catch (e) {
      toast.error(`Import failed: ${e}`);
    }
  }

  async function browseGamePath() {
    const selected = await open({ directory: true, title: "Select Crimson Desert folder" });
    if (selected) {
      saveConfig({ ...config, gamePath: selected });
    }
  }

  async function browseModsPath() {
    const selected = await open({ directory: true, title: "Select mods folder" });
    if (selected) {
      saveConfig({ ...config, modsPath: selected });
    }
  }

  async function enableAsiMod(name: string) {
    try {
      await invoke("enable_asi_mod", { gamePath: config.gamePath, pluginName: name });
      addLog(`ASI enabled: ${name}`, "success");
      toast.success(`Enabled ASI: ${name}`);
      scanAsiMods();
    } catch (e) {
      addLog(`Failed to enable ASI: ${e}`, "error");
      toast.error(`Failed to enable ASI: ${e}`);
    }
  }

  async function disableAsiMod(name: string) {
    try {
      await invoke("disable_asi_mod", { gamePath: config.gamePath, pluginName: name });
      addLog(`ASI disabled: ${name}`, "info");
      toast.success(`Disabled ASI: ${name}`);
      scanAsiMods();
    } catch (e) {
      addLog(`Failed to disable ASI: ${e}`, "error");
      toast.error(`Failed to disable ASI: ${e}`);
    }
  }

  async function installAsiMod() {
    const selected = await open({
      title: "Install ASI Mod",
      filters: [
        { name: "ASI Plugins", extensions: ["asi"] },
      ],
      multiple: false,
      directory: false,
    });
    if (!selected) return;

    const sourcePath = selected as string;
    try {
      const installed = await invoke<string[]>("install_asi_mod", {
        sourcePath,
        gamePath: config.gamePath,
      });
      addLog(`Installed ASI files: ${installed.join(", ")}`, "success");
      toast.success(`Installed ${installed.length} file(s)`);
      scanAsiMods();
    } catch (e) {
      addLog(`ASI install failed: ${e}`, "error");
      toast.error(`ASI install failed: ${e}`);
    }
  }

  async function uninstallAsiMod(name: string) {
    try {
      const deleted = await invoke<string[]>("uninstall_asi_mod", {
        gamePath: config.gamePath,
        pluginName: name,
      });
      addLog(`Uninstalled ASI: ${deleted.join(", ")}`, "info");
      toast.success(`Uninstalled: ${name}`);
      scanAsiMods();
    } catch (e) {
      addLog(`Failed to uninstall ASI: ${e}`, "error");
      toast.error(`Failed to uninstall ASI: ${e}`);
    }
  }

  async function openAsiConfig(name: string) {
    try {
      await invoke("open_asi_config", { gamePath: config.gamePath, pluginName: name });
    } catch (e) {
      addLog(`Failed to open ASI config: ${e}`, "error");
      toast.error(`Failed to open config: ${e}`);
    }
  }

  async function installAsiLoader() {
    setInstallingLoader(true);
    addLog("Downloading Ultimate ASI Loader...", "info");
    try {
      const result = await invoke<string>("install_asi_loader", { gamePath: config.gamePath });
      toast.success(result);
      addLog(result, "success");
      scanAsiMods();
    } catch (e) {
      toast.error(`${e}`);
      addLog(`ASI Loader install failed: ${e}`, "error");
    } finally {
      setInstallingLoader(false);
    }
  }

  async function toggleReshade(enable: boolean) {
    try {
      await invoke("toggle_reshade", { gamePath: config.gamePath, enable });
      addLog(`ReShade ${enable ? "enabled" : "disabled"}`, enable ? "success" : "info");
      toast.success(`ReShade ${enable ? "enabled" : "disabled"}`);
      scanReshade();
    } catch (e) {
      addLog(`Failed to toggle ReShade: ${e}`, "error");
      toast.error(`Failed to toggle ReShade: ${e}`);
    }
  }

  async function setReshadePreset(presetName: string) {
    try {
      await invoke("set_reshade_preset", { gamePath: config.gamePath, presetName });
      addLog(`ReShade preset set: ${presetName}`, "success");
      toast.success(`Preset activated: ${presetName}`);
      scanReshade();
    } catch (e) {
      addLog(`Failed to set ReShade preset: ${e}`, "error");
      toast.error(`Failed to set preset: ${e}`);
    }
  }

  async function openReshadeConfig() {
    try {
      await invoke("open_reshade_config", { gamePath: config.gamePath });
    } catch (e) {
      addLog(`Failed to open ReShade config: ${e}`, "error");
      toast.error(`Failed to open config: ${e}`);
    }
  }

  const activeCount = config.activeMods.length;

  // Build disabled indices map for per-patch toggles
  const disabledIndicesMap: Record<string, number[]> = {};
  for (const am of config.activeMods) {
    if (am.disabledIndices.length > 0) {
      disabledIndicesMap[am.fileName] = am.disabledIndices;
    }
  }

  // Version warning
  const versionWarning = gameVersion && lastKnownVersion && gameVersion.paver_hex !== lastKnownVersion
    ? `Game version has changed (${lastKnownVersion} -> ${gameVersion.paver_hex}). Re-mount your mods to ensure compatibility.`
    : null;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative" style={{ padding: 0 }}>
      <Titlebar />
      {/* Drag-and-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-accent" style={{ margin: "8px" }}>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent mb-2">Drop Mods Here</p>
            <p className="text-sm text-text-muted">.json or .zip files</p>
          </div>
        </div>
      )}
      <div className="flex flex-1 min-h-0" style={{ padding: "12px", gap: "10px" }}>
        <Sidebar
          activeView={view}
          onViewChange={setView}
          modCount={mods.length}
          activeCount={activeCount}
          conflictCount={conflicts.length}
          asiCount={asiStatus?.plugins.length}
          onOpenModsFolder={() => {
            if (config.modsPath) {
              invoke("open_folder", { folderPath: config.modsPath }).catch(() => {});
            }
          }}
          onOpenGameFolder={() => {
            if (config.gamePath) {
              invoke("open_folder", { folderPath: config.gamePath }).catch(() => {});
            }
          }}
        />
        <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ gap: "10px" }}>
          {/* Main content area (~70%) */}
          <main className="flex-[7] min-h-0 overflow-hidden border border-border/30 bg-surface/20">
            {view === "mods" && (
              <ModList
                mods={mods}
                onToggle={toggleMod}
                onReorder={reorderMods}
                onApply={applyMods}
                onRevert={revertMods}
                onImport={importMod}
                onEnableAll={enableAll}
                onDisableAll={disableAll}
                onStartGame={startGame}
                onCheck={runDetailedCheck}
                onRecover={recoverInterrupted}
                applying={applying}
                disabledIndicesMap={disabledIndicesMap}
                onTogglePatch={togglePatch}
                modDetails={modDetails}
                onExpandMod={loadModDetails}
                versionWarning={versionWarning}
                updateStatuses={updateStatuses}
                mountedMods={mountedMods}
                onDeleteMod={deleteMod}
              />
            )}
            {view === "conflicts" && <ConflictView conflicts={conflicts} />}
            {view === "language" && (
              <LanguageView
                langMods={langMods}
                selectedLanguage={config.selectedLanguage}
                onActivate={activateLangMod}
                onImportLang={importLangMod}
              />
            )}
            {view === "asi" && (
              <AsiModView
                asiStatus={asiStatus}
                onRefresh={scanAsiMods}
                onEnable={enableAsiMod}
                onDisable={disableAsiMod}
                onInstall={installAsiMod}
                onUninstall={uninstallAsiMod}
                onOpenConfig={openAsiConfig}
                onInstallLoader={installAsiLoader}
                installingLoader={installingLoader}
              />
            )}
            {view === "reshade" && (
              <ReshadeView
                reshadeStatus={reshadeStatus}
                onRefresh={scanReshade}
                onToggle={toggleReshade}
                onSetPreset={setReshadePreset}
                onOpenConfig={openReshadeConfig}
              />
            )}
            {view === "settings" && (
              <SettingsView
                gamePath={config.gamePath}
                modsPath={config.modsPath}
                gamePathValid={gamePathValid}
                onGamePathChange={(p) => saveConfig({ ...config, gamePath: p })}
                onModsPathChange={(p) => saveConfig({ ...config, modsPath: p })}
                onBrowseGamePath={browseGamePath}
                onBrowseModsPath={browseModsPath}
                nexusApiKey={config.nexusApiKey}
                onNexusApiKeyChange={(key) => saveConfig({ ...config, nexusApiKey: key })}
                onCheckUpdates={checkForUpdates}
                checkingUpdates={checkingUpdates}
              />
            )}
            {view === "profiles" && (
              <ProfileManager
                profiles={profiles}
                onSave={saveProfile}
                onLoad={loadProfileConfig}
                onDelete={deleteProfile}
              />
            )}
            {view === "backups" && (
              <BackupManager
                backups={backups}
                onRestore={restoreSingleBackup}
                onDelete={deleteBackup}
                onRestoreAll={revertMods}
              />
            )}
            {view === "about" && <AboutView />}
          </main>
          {/* Log panel (~30%) */}
          <div className="flex-[3] min-h-0 border border-border/30 bg-surface/20">
            <LogPanel logs={logs} onClear={clearLogs} />
          </div>
        </div>
      </div>
      <div style={{ padding: "0 12px 12px 12px" }}>
        <StatusBar
          gamePath={config.gamePath}
          modsPath={config.modsPath}
          gamePathValid={gamePathValid}
          papgtStatus={papgtStatus}
        />
      </div>
      {showPreflight && (
        <PreflightDialog
          result={preflightResult}
          onClose={() => setShowPreflight(false)}
          onProceed={() => {
            setShowPreflight(false);
            doMount();
          }}
          checking={preflightChecking}
        />
      )}
      {showCheckResult && checkResult && (
        <CheckResultDialog
          result={checkResult}
          onClose={() => setShowCheckResult(false)}
        />
      )}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#12121a",
            border: "1px solid #2a2a3a",
            color: "#e8e8f0",
          },
        }}
      />
    </div>
  );
}
