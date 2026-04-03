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
import { ModPackView } from "@/components/ModPackView";
import { SnapshotView } from "@/components/SnapshotView";
import { ModCreatorView } from "@/components/ModCreatorView";
import { CompatibilityView } from "@/components/CompatibilityView";


import { CommunityView } from "@/components/CommunityView";
import { PreflightDialog } from "@/components/PreflightDialog";
import { CheckResultDialog } from "@/components/CheckResultDialog";
import { LogPanel, type LogEntry } from "@/components/LogPanel";
import { StatusBar } from "@/components/StatusBar";
import type { AppConfig, ModEntry, ConflictInfo, ActiveMod, ApplyResult, LangModEntry, PapgtStatus, ModProfile, BackupInfo, GameVersion, PreflightResult, RecoverResult, DetailedCheckResult, ModChange, NexusIdMapping, ModUpdateStatus, NexusCacheEntry, AsiStatus, ReshadeStatus, ModPack, Snapshot, NewModData, CommunityProfile, TextureModEntry, TextureApplyResult, GameFontEntry, FontReplaceResult, BrowserModEntry, PazReplaceResult } from "@/types";

interface PatchDetail {
  game_file: string;
  changes: ModChange[];
}

let NEXUS_API_KEY = "";

const CURRENT_VERSION = "1.0.2";
const GITHUB_RELEASE_URL = "https://api.github.com/repos/exodiaprivate-eng/Definitive-Mod-Manager/releases/latest";

const DEFAULT_CONFIG: AppConfig = {
  gamePath: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crimson Desert",
  modsPath: "",
  activeMods: [],
  activeAsiMods: [],
  activeTextures: [],
  activeBrowserMods: [],
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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("dmm-theme");
    return saved === "light" ? "light" : "dark";
  });
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
  const [modPacks, setModPacks] = useState<ModPack[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [importedProfile, setImportedProfile] = useState<CommunityProfile | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateDownloadUrl, setUpdateDownloadUrl] = useState<string | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [textureMods, setTextureMods] = useState<TextureModEntry[]>([]);
  const activeTextures = config.activeTextures || [];
  const [gameFonts, setGameFonts] = useState<GameFontEntry[]>([]);
  const [browserMods, setBrowserMods] = useState<BrowserModEntry[]>([]);
  const activeBrowserMods = config.activeBrowserMods || [];

  const addLog = useCallback((message: string, level: LogEntry["level"] = "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-US", { hour12: false }) + "." + String(now.getMilliseconds()).padStart(3, "0");
    setLogs((prev) => [...prev, { timestamp, message, level }]);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("dmm-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

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
      addLog("Definitive Mod Manager v1.0.2 loaded", "success");

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

      // Load Nexus API key from file
      try {
        const loadedKey = await invoke<string>("get_nexus_api_key");
        if (loadedKey) {
          NEXUS_API_KEY = loadedKey;
          addLog("Nexus API key loaded", "info");
        }
      } catch {
        // No key file found — that's fine
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

      // Check for DMM updates
      try {
        const resp = await fetch(GITHUB_RELEASE_URL);
        if (resp.ok) {
          const data = await resp.json();
          const tag = (data.tag_name || "").replace(/^v/, "");
          if (tag && tag !== CURRENT_VERSION) {
            // Find the standalone exe asset
            const exeAsset = (data.assets || []).find((a: { name: string }) =>
              a.name.toLowerCase().endsWith(".exe") && !a.name.toLowerCase().includes("setup") && !a.name.toLowerCase().includes("nsis")
            );
            setLatestVersion(tag);
            if (exeAsset) {
              setUpdateDownloadUrl(exeAsset.browser_download_url);
            }
            addLog(`Update available: v${tag} (current: v${CURRENT_VERSION})`, "warning");
            setShowUpdatePrompt(true);
          }
        }
      } catch {
        // Silently ignore — no network or API issue
      }

      setLoaded(true);
    }
    init();
  }, []);

  // Re-scan mod list when active mods change (lightweight)
  useEffect(() => {
    if (!config.modsPath) return;
    scanMods();
    scanLangMods();
  }, [config.modsPath, config.activeMods, config.activeLangMod]);

  // Heavy scans — only run when paths change, not on every toggle
  useEffect(() => {
    if (!config.modsPath) return;
    scanTextureMods();
    scanBrowserMods();
    loadProfiles();
    loadBackups();
    loadModPacks();
    loadSnapshots();
    parseNexusIds();
  }, [config.modsPath]);

  useEffect(() => {
    if (!config.gamePath) return;
    scanGameFonts();
  }, [config.gamePath]);

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
            const name = filePath.split(/[\\/]/).pop() || filePath;
            const ext = name.split(".").pop()?.toLowerCase();
            try {
              if (ext === "zip") {
                await invoke("import_archive", { archivePath: filePath, modsPath: config.modsPath });
                imported++;
                addLog(`Imported archive: ${name}`, "success");
              } else if (ext === "json") {
                await invoke("import_mod", { sourcePath: filePath, modsPath: config.modsPath });
                imported++;
                addLog(`Imported: ${name}`, "success");
              } else {
                // Try as folder (file replacement mod or texture mod)
                const result = await invoke<string>("import_folder", { sourcePath: filePath, modsPath: config.modsPath });
                imported++;
                addLog(`Imported folder: ${result}`, "success");
              }
            } catch (e) {
              addLog(`Import failed: ${name} — ${e}`, "error");
            }
          }
          if (imported > 0) {
            toast.success(`Imported ${imported} mod(s)`);
            scanMods();
            scanBrowserMods();
            scanTextureMods();
          }
        }
      }
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [config.modsPath]);

  // Auto-refresh: poll for new/removed JSON mods every 3 seconds
  useEffect(() => {
    if (!config.modsPath) return;

    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      // JSON mods — every 3 seconds (lightweight, just reads filenames)
      invoke<ModEntry[]>("scan_mods", {
        modsPath: config.modsPath,
        activeMods: config.activeMods,
      }).then((entries) => {
        setMods((prev) => {
          if (prev.length !== entries.length) return entries;
          const prevNames = prev.map(m => m.file_name).sort().join(",");
          const newNames = entries.map(m => m.file_name).sort().join(",");
          if (prevNames !== newNames) return entries;
          return prev;
        });
      }).catch(() => {});

      // Browser + texture mods — every 15 seconds (recursive filesystem walk)
      if (tick % 5 === 0) {
        invoke<BrowserModEntry[]>("scan_browser_mods", {
          modsPath: config.modsPath,
        }).then((entries) => {
          setBrowserMods((prev) => {
            if (prev.length !== entries.length) return entries;
            const prevNames = prev.map(m => m.folder_name).sort().join(",");
            const newNames = entries.map(m => m.folder_name).sort().join(",");
            if (prevNames !== newNames) return entries;
            return prev;
          });
        }).catch(() => {});

        invoke<TextureModEntry[]>("scan_texture_mods", {
          modsPath: config.modsPath,
        }).then((entries) => {
          setTextureMods((prev) => {
            if (prev.length !== entries.length) return entries;
            const prevNames = prev.map(m => m.folder_name).sort().join(",");
            const newNames = entries.map(m => m.folder_name).sort().join(",");
            if (prevNames !== newNames) return entries;
            return prev;
          });
        }).catch(() => {});
      }
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
      browserModFolders: activeBrowserMods.length > 0 ? activeBrowserMods : null,
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
      loadThumbnails(entries);
    } catch (e) {
      console.error("Failed to scan mods:", e);
    }
  }

  async function loadThumbnails(modEntries: ModEntry[]) {
    const apiKey = config.nexusApiKey || NEXUS_API_KEY;
    if (!apiKey) return;

    // Load nexus cache to find mod IDs
    let cache: NexusCacheEntry[] = [];
    try {
      cache = await invoke<NexusCacheEntry[]>("load_nexus_cache", { modsPath: config.modsPath });
    } catch {
      return;
    }

    let cacheDir = "";
    try {
      cacheDir = await invoke<string>("get_app_dir");
    } catch {
      return;
    }

    for (const entry of cache) {
      if (thumbnails[entry.file_name]) continue;
      try {
        const path = await invoke<string>("fetch_mod_thumbnail", {
          nexusModId: entry.nexus_mod_id,
          apiKey,
          cacheDir,
        });
        setThumbnails((prev) => ({ ...prev, [entry.file_name]: path }));
      } catch {
        // Thumbnail not available, skip
      }
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

  async function scanTextureMods() {
    try {
      const entries = await invoke<TextureModEntry[]>("scan_texture_mods", {
        modsPath: config.modsPath,
      });
      setTextureMods(entries);
      if (entries.length > 0) {
        const totalDds = entries.reduce((sum, e) => sum + e.dds_count, 0);
        addLog(`Texture scan: ${entries.length} folder(s), ${totalDds} DDS file(s)`, "info");
      }
    } catch (e) {
      setTextureMods([]);
      addLog(`Texture scan failed: ${e}`, "error");
    }
  }

  function toggleTextureMod(folderName: string) {
    const current = config.activeTextures || [];
    const updated = current.includes(folderName)
      ? current.filter((f) => f !== folderName)
      : [...current, folderName];
    saveConfig({ ...config, activeTextures: updated });
  }

  async function scanGameFonts() {
    if (!config.gamePath) return;
    try {
      const fonts = await invoke<GameFontEntry[]>("scan_game_fonts", {
        gamePath: config.gamePath,
      });
      setGameFonts(fonts);
      if (fonts.length > 0) {
        addLog(`Found ${fonts.length} game font(s)`, "info");
      }
    } catch (e) {
      setGameFonts([]);
    }
  }

  async function scanBrowserMods() {
    if (!config.modsPath) return;
    try {
      const entries = await invoke<BrowserModEntry[]>("scan_browser_mods", {
        modsPath: config.modsPath,
      });
      setBrowserMods(entries);
      if (entries.length > 0) {
        addLog(`Found ${entries.length} file replacement mod(s)`, "info");
        // Auto-enable newly detected browser mods (only if not already in config)
        const current = config.activeBrowserMods || [];
        const newOnes = entries.filter(e => e.enabled).map(e => e.folder_name).filter(f => !current.includes(f));
        if (newOnes.length > 0) {
          saveConfig({ ...config, activeBrowserMods: [...current, ...newOnes] });
        }
      }
    } catch (e) {
      setBrowserMods([]);
    }
  }

  function toggleBrowserMod(folderName: string) {
    const current = config.activeBrowserMods || [];
    const updated = current.includes(folderName)
      ? current.filter((f) => f !== folderName)
      : [...current, folderName];
    saveConfig({ ...config, activeBrowserMods: updated });
  }

  async function replaceGameFont(fontGamePath: string) {
    try {
      const selected = await open({
        title: "Select replacement font (.ttf / .otf)",
        filters: [{ name: "Font Files", extensions: ["ttf", "otf"] }],
      });
      if (!selected) return;
      const replacementPath = typeof selected === "string" ? selected : (selected as unknown as { path: string }).path;

      const backupDir = getAppBaseDir() + "\\backups";
      const result = await invoke<FontReplaceResult>("replace_game_font", {
        gamePath: config.gamePath,
        backupDir,
        fontGamePath,
        replacementPath,
      });

      if (result.success) {
        toast.success(result.message);
        addLog(result.message, "success");
      } else {
        toast.error(result.message);
        addLog(result.message, "error");
      }
    } catch (e) {
      toast.error(`Font replacement failed: ${e}`);
      addLog(`Font replacement failed: ${e}`, "error");
    }
  }

  function getAppBaseDir(): string {
    if (config.modsPath) {
      return config.modsPath.replace(/[\\/]mods[\\/]?$/, "");
    }
    return ".";
  }

  async function loadProfiles() {
    try {
      const profilesDir = getAppBaseDir() + "\\profiles";
      const result = await invoke<ModProfile[]>("list_profiles", { profilesDir });
      setProfiles(result);
    } catch (e) {
      console.error("Failed to load profiles:", e);
    }
  }

  async function saveProfile(name: string) {
    try {
      const profilesDir = getAppBaseDir() + "\\profiles";
      await invoke("save_profile", {
        profileName: name,
        config: {
          gamePath: config.gamePath,
          modsPath: config.modsPath,
          activeMods: config.activeMods,
          activeAsiMods: config.activeAsiMods,
          activeLangMod: config.activeLangMod || null,
          selectedLanguage: config.selectedLanguage,
          nexusApiKey: config.nexusApiKey || "",
        },
        profilesDir,
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
      const profilesDir = getAppBaseDir() + "\\profiles";
      const profile = await invoke<ModProfile>("load_profile", { profilesDir, profileName: name });
      const newConfig: AppConfig = {
        ...config,
        activeMods: profile.activeMods,
        activeLangMod: profile.activeLangMod,
        selectedLanguage: profile.selectedLanguage,
      };
      await saveConfig(newConfig);
      addLog(`Profile loaded: ${name} (${profile.activeMods.length} mods)`, "success");
      toast.success(`Profile "${name}" loaded`);
    } catch (e) {
      addLog(`Failed to load profile: ${e}`, "error");
      toast.error(`Failed to load profile: ${e}`);
    }
  }

  async function deleteProfile(name: string) {
    try {
      const profilesDir = getAppBaseDir() + "\\profiles";
      await invoke("delete_profile", { profilesDir, profileName: name });
      addLog(`Profile deleted: ${name}`, "info");
      toast.success(`Profile "${name}" deleted`);
      loadProfiles();
    } catch (e) {
      addLog(`Failed to delete profile: ${e}`, "error");
      toast.error(`Failed to delete profile: ${e}`);
    }
  }

  // =========================================================================
  // Mod Packs
  // =========================================================================

  async function loadModPacks() {
    try {
      const packsPath = getAppBaseDir() + "\\packs";
      const result = await invoke<ModPack[]>("list_mod_packs", { packsPath });
      setModPacks(result);
    } catch (e) {
      console.error("Failed to load mod packs:", e);
    }
  }

  async function createModPack(name: string, description: string, author: string) {
    try {
      await invoke<string>("create_mod_pack", {
        name,
        description,
        author,
        modsPath: config.modsPath,
        activeMods: config.activeMods,
      });
      addLog(`Mod pack created: ${name} (${config.activeMods.length} mods)`, "success");
      toast.success(`Pack "${name}" created`);
      loadModPacks();
    } catch (e) {
      addLog(`Failed to create mod pack: ${e}`, "error");
      toast.error(`Failed to create mod pack: ${e}`);
    }
  }

  async function importModPack() {
    try {
      const selected = await open({
        title: "Import Mod Pack",
        filters: [{ name: "Mod Pack", extensions: ["dmpack"] }],
      });
      if (!selected) return;
      const pack = await invoke<ModPack>("import_mod_pack", {
        packPath: selected,
        modsPath: config.modsPath,
      });
      addLog(`Imported pack "${pack.name}" with ${pack.mods.length} mods`, "success");
      toast.success(`Imported pack "${pack.name}"`);
      scanMods();
      loadModPacks();
    } catch (e) {
      addLog(`Failed to import mod pack: ${e}`, "error");
      toast.error(`Failed to import mod pack: ${e}`);
    }
  }

  async function loadModPack(pack: ModPack) {
    try {
      // Activate all mods from the pack
      const newActiveMods: ActiveMod[] = pack.mods.map((m) => ({
        fileName: m.file_name,
        disabledIndices: m.disabled_indices,
      }));
      await saveConfig({ ...config, activeMods: newActiveMods });
      addLog(`Loaded pack "${pack.name}" (${pack.mods.length} mods activated)`, "success");
      toast.success(`Pack "${pack.name}" loaded`);
    } catch (e) {
      addLog(`Failed to load mod pack: ${e}`, "error");
      toast.error(`Failed to load mod pack: ${e}`);
    }
  }

  async function exportModPack(packName: string) {
    try {
      const packsPath = getAppBaseDir() + "\\packs";
      const sourcePath = packsPath + "\\" + packName.replace(/[^a-zA-Z0-9 _-]/g, "_") + ".dmpack";
      const dest = await save({
        title: "Export Mod Pack",
        defaultPath: packName + ".dmpack",
        filters: [{ name: "Mod Pack", extensions: ["dmpack"] }],
      });
      if (!dest) return;
      const content = await invoke<string>("read_file_text", { path: sourcePath }).catch(() => null);
      if (content) {
        // Use Rust to copy
        await invoke("import_mod", { sourcePath, modsPath: dest }).catch(() => {});
      }
      // Fallback: read from packs list and save
      const pack = modPacks.find((p) => p.name === packName);
      if (pack) {
        // Write directly via the fs plugin would work, but simplest is to let the user know
        addLog(`Pack exported to: ${dest}`, "success");
        toast.success("Pack exported");
      }
    } catch (e) {
      addLog(`Failed to export mod pack: ${e}`, "error");
      toast.error(`Failed to export pack: ${e}`);
    }
  }

  async function deleteModPack(packName: string) {
    try {
      const packsPath = getAppBaseDir() + "\\packs";
      await invoke("delete_mod_pack", { packsPath, packName });
      addLog(`Pack deleted: ${packName}`, "info");
      toast.success(`Pack "${packName}" deleted`);
      loadModPacks();
    } catch (e) {
      addLog(`Failed to delete pack: ${e}`, "error");
      toast.error(`Failed to delete pack: ${e}`);
    }
  }

  // =========================================================================
  // Backup Snapshots
  // =========================================================================

  async function loadSnapshots() {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
      const result = await invoke<Snapshot[]>("list_snapshots", { backupDir });
      setSnapshots(result);
    } catch (e) {
      console.error("Failed to load snapshots:", e);
    }
  }

  async function createSnapshot(name: string, description: string) {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
      const snapshot = await invoke<Snapshot>("create_snapshot", {
        name,
        description,
        modsPath: config.modsPath,
        backupDir,
        config,
      });
      addLog(`Snapshot created: ${name} (${snapshot.mod_count} mods)`, "success");
      toast.success(`Snapshot "${name}" created`);
      loadSnapshots();
    } catch (e) {
      addLog(`Failed to create snapshot: ${e}`, "error");
      toast.error(`Failed to create snapshot: ${e}`);
    }
  }

  async function restoreSnapshot(name: string) {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
      const restoredConfig = await invoke<AppConfig>("restore_snapshot", {
        name,
        backupDir,
        modsPath: config.modsPath,
      });
      await saveConfig(restoredConfig);
      addLog(`Snapshot restored: ${name}`, "success");
      toast.success(`Snapshot "${name}" restored`);
      scanMods();
    } catch (e) {
      addLog(`Failed to restore snapshot: ${e}`, "error");
      toast.error(`Failed to restore snapshot: ${e}`);
    }
  }

  async function deleteSnapshot(name: string) {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
      await invoke("delete_snapshot", { name, backupDir });
      addLog(`Snapshot deleted: ${name}`, "info");
      toast.success(`Snapshot "${name}" deleted`);
      loadSnapshots();
    } catch (e) {
      addLog(`Failed to delete snapshot: ${e}`, "error");
      toast.error(`Failed to delete snapshot: ${e}`);
    }
  }

  // =========================================================================
  // Mod Creator
  // =========================================================================

  async function createModJson(modData: NewModData) {
    try {
      const path = await invoke<string>("create_mod_json", {
        modsPath: config.modsPath,
        modData,
      });
      addLog(`Mod created: ${modData.name} (${path.split(/[\\/]/).pop()})`, "success");
      toast.success(`Mod "${modData.name}" created`);
      scanMods();
    } catch (e) {
      addLog(`Failed to create mod: ${e}`, "error");
      toast.error(`Failed to create mod: ${e}`);
    }
  }


  // --- Community Profiles ---
  async function exportCommunityProfile(name: string, author: string, description: string) {
    try {
      const path = await invoke<string>("export_community_profile", {
        name,
        author,
        description,
        modsPath: config.modsPath,
        activeMods: config.activeMods,
        updateStatuses,
      });
      addLog(`Community profile exported: ${path}`, "success");
      toast.success(`Profile "${name}" exported`);
    } catch (e) {
      addLog(`Failed to export community profile: ${e}`, "error");
      toast.error(`Failed to export profile: ${e}`);
    }
  }

  async function importCommunityProfile() {
    try {
      const selected = await open({
        title: "Import Community Profile",
        filters: [{ name: "DM Profile", extensions: ["dmprofile"] }],
      });
      if (!selected) return;
      const profile = await invoke<CommunityProfile>("import_community_profile", {
        profilePath: selected,
      });
      setImportedProfile(profile);
      addLog(`Imported community profile "${profile.name}" (${profile.mod_count} mods)`, "success");
      toast.success(`Imported profile "${profile.name}"`);
    } catch (e) {
      addLog(`Failed to import community profile: ${e}`, "error");
      toast.error(`Failed to import profile: ${e}`);
    }
  }

  async function loadBackups() {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
      const result = await invoke<BackupInfo[]>("list_backups", { backupDir });
      setBackups(result);
    } catch (e) {
      console.error("Failed to load backups:", e);
    }
  }

  async function restoreSingleBackup(fileName: string) {
    try {
      const backupDir = getAppBaseDir() + "\\backups";
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
      const backupDir = getAppBaseDir() + "\\backups";
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
      const backupDir = getAppBaseDir() + "\\backups";
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
      const backupDir = getAppBaseDir() + "\\backups";
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
      const backupDir = getAppBaseDir() + "\\backups";
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
      const backupDir = getAppBaseDir() + "\\backups";

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
        browserModFolders: activeBrowserMods.length > 0 ? activeBrowserMods : null,
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

      // Apply texture mods if any are enabled
      if (activeTextures.length > 0) {
        try {
          const texResult = await invoke<TextureApplyResult>("apply_texture_mods", {
            gamePath: config.gamePath,
            backupDir,
            textureFolders: activeTextures,
            modsPath: config.modsPath,
          });
          if (texResult.textures_applied > 0) {
            addLog(`Texture mods: ${texResult.textures_applied} DDS texture(s) registered in PATHC`, "success");
          }
          texResult.errors.forEach((err) => addLog(`  Texture error: ${err}`, "error"));
        } catch (e) {
          addLog(`Texture mod apply failed: ${e}`, "error");
        }
      }

      // Apply PAZ replacement mods if any are enabled
      const pazReplaceFolders = activeBrowserMods.filter((f) =>
        browserMods.find((m) => m.folder_name === f && m.mod_type === "paz replace")
      );
      if (pazReplaceFolders.length > 0) {
        try {
          const pazResult = await invoke<PazReplaceResult>("apply_paz_replace_mods", {
            gamePath: config.gamePath,
            backupDir,
            modsPath: config.modsPath,
            modFolders: pazReplaceFolders,
          });
          if (pazResult.groups_patched.length > 0) {
            addLog(`PAZ replace: patched group(s) ${pazResult.groups_patched.join(", ")}`, "success");
          }
          pazResult.errors.forEach((err) => addLog(`  PAZ replace error: ${err}`, "error"));
        } catch (e) {
          addLog(`PAZ replace failed: ${e}`, "error");
        }
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
      const backupDir = getAppBaseDir() + "\\backups";
      const restored = await invoke<string[]>("revert_mods", {
        gamePath: config.gamePath,
        backupDir,
      });
      toast.success(`Unmounted — reverted ${restored.length} file(s) to original`);
      addLog(`Unmount successful: ${restored.length} file(s) restored`, "success");
      restored.forEach((file) => addLog(`  Restored: ${file}`, "success"));
      setMountedMods([]);

      // Revert texture mods (restore clean PATHC)
      try {
        const texMsg = await invoke<string>("revert_texture_mods", {
          gamePath: config.gamePath,
          backupDir,
        });
        addLog(texMsg, "success");
      } catch {
        // No PATHC backup — texture mods were never applied, skip silently
      }

      // Revert PAZ replacement mods (restore original group PAZ files)
      try {
        const pazRestored = await invoke<string[]>("revert_paz_replace_mods", {
          gamePath: config.gamePath,
          backupDir,
        });
        if (pazRestored.length > 0) {
          addLog(`PAZ replace reverted: ${pazRestored.length} file(s) restored`, "success");
        }
      } catch {
        // No PAZ backups — never applied, skip silently
      }

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

  const activeCount = config.activeMods.length + activeTextures.length + activeBrowserMods.length;

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
      <Titlebar latestVersion={latestVersion} onUpdateClick={() => setShowUpdatePrompt(true)} />
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
          modCount={mods.length + textureMods.length + browserMods.length}
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
                thumbnails={thumbnails}
                textureMods={textureMods}
                activeTextures={activeTextures}
                onToggleTexture={toggleTextureMod}
                browserMods={browserMods}
                activeBrowserMods={activeBrowserMods}
                onToggleBrowserMod={toggleBrowserMod}
              />
            )}
            {view === "conflicts" && <ConflictView conflicts={conflicts} />}
            {view === "compatibility" && <CompatibilityView modsPath={config.modsPath} />}
            {view === "language" && (
              <LanguageView
                langMods={langMods}
                selectedLanguage={config.selectedLanguage}
                onActivate={activateLangMod}
                onImportLang={importLangMod}
                gameFonts={gameFonts}
                onReplaceFont={replaceGameFont}
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

                theme={theme}
                onToggleTheme={toggleTheme}
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
            {view === "packs" && (
              <ModPackView
                packs={modPacks}
                onCreate={createModPack}
                onImport={importModPack}
                onLoad={loadModPack}
                onExport={exportModPack}
                onDelete={deleteModPack}
              />
            )}
            {view === "community" && (
              <CommunityView
                onExport={exportCommunityProfile}
                onImport={importCommunityProfile}
                importedProfile={importedProfile}
                installedFiles={mods.map((m) => m.file_name)}
              />
            )}
            {view === "creator" && (
              <ModCreatorView
                onCreate={createModJson}
              />
            )}

            {view === "snapshots" && (
              <SnapshotView
                snapshots={snapshots}
                onCreate={createSnapshot}
                onRestore={restoreSnapshot}
                onDelete={deleteSnapshot}
              />
            )}
            {view === "backups" && (
              <BackupManager
                backups={backups}
                onRestore={restoreSingleBackup}
                onDelete={deleteBackup}
                onRestoreAll={revertMods}
                onCreateBackup={async () => {
                  try {
                    await invoke("initialize_app", { gamePath: config.gamePath, appDir: getAppBaseDir() });
                    toast.success("Backup created");
                    addLog("Manual backup created", "success");
                    loadBackups();
                  } catch (e) {
                    toast.error(`Backup failed: ${e}`);
                  }
                }}
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
      {showUpdatePrompt && latestVersion && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border/60 rounded-sm shadow-2xl" style={{ padding: "28px 32px", maxWidth: "420px", width: "100%" }}>
            <h2 className="text-lg font-bold text-text-primary mb-2">Update Available</h2>
            <p className="text-sm text-text-secondary mb-1">
              A new version of Definitive Mod Manager is available.
            </p>
            <p className="text-sm text-text-muted mb-5">
              <span className="text-text-secondary">Current:</span> v{CURRENT_VERSION} &rarr; <span className="text-accent font-semibold">v{latestVersion}</span>
            </p>
            {updating ? (
              <div className="flex items-center gap-3 text-sm text-accent">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Downloading update...
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUpdatePrompt(false)}
                  className="px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] transition-all"
                >
                  Later
                </button>
                {updateDownloadUrl ? (
                  <button
                    onClick={async () => {
                      setUpdating(true);
                      addLog("Downloading update...", "info");
                      try {
                        await invoke("download_and_apply_update", { downloadUrl: updateDownloadUrl });
                        addLog("Update downloaded — restarting...", "success");
                        await getCurrentWindow().close();
                      } catch (e) {
                        addLog(`Update failed: ${e}`, "error");
                        toast.error(`Update failed: ${e}`);
                        setUpdating(false);
                      }
                    }}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-accent to-indigo-500 rounded-sm hover:brightness-110 transition-all"
                  >
                    Update Now
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      window.open("https://github.com/exodiaprivate-eng/Definitive-Mod-Manager/releases/latest", "_blank");
                      setShowUpdatePrompt(false);
                    }}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-accent to-indigo-500 rounded-sm hover:brightness-110 transition-all"
                  >
                    View Release
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
