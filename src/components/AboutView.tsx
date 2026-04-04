import {
  Swords,
  Blocks,
  Bookmark,
  Globe,
  AlertTriangle,
  Archive,
  Rocket,
  Play,
  Search,
  FileCode2,
  Shield,
  FolderPlus,
  Share2,
  Eye,
  Wrench,
  ClipboardCheck,
  RefreshCw,
  Terminal,
  Layers,
  MonitorDown,
  Package,
  GripVertical,
  FolderOpen,
  Download,
  Heart,
  Image,
  Type,
  Puzzle,
  Camera,
  Grid3x3,
  Users,
  Hammer,
} from "lucide-react";

const features = [
  { icon: Blocks, label: "Mod Management", desc: "Enable, disable, and reorder mods with drag-and-drop load ordering" },
  { icon: Rocket, label: "Mount / Unmount", desc: "One-click mounting with automatic backup — always patches from clean vanilla" },
  { icon: Package, label: "Multi-File Patching", desc: "Supports mods targeting ANY .pabgb game file (storeinfo, inventory, recipes, etc.)" },
  { icon: Layers, label: "PAZ Overlay System", desc: "Reverse-engineered Pearl Abyss archive format — builds game-compatible overlays" },
  { icon: Puzzle, label: "File Replacement Mods", desc: "Auto-detects and mounts manifest.json + files/ mods — full PAZ file replacement alongside JSON patches" },
  { icon: Image, label: "Texture Mods", desc: "DDS texture replacement support via PATHC index with automatic backup and restore" },
  { icon: Type, label: "Font Replacement", desc: "Replace per-language game fonts (.ttf) with custom fonts via PAZ overlay" },
  { icon: AlertTriangle, label: "Conflict Detection", desc: "Warns when multiple mods patch the same offset or replace the same file — works across all mod types" },
  { icon: Grid3x3, label: "Compatibility Matrix", desc: "Visual grid showing pairwise compatibility between all installed mods" },
  { icon: Bookmark, label: "Mod Profiles", desc: "Save and load named mod configurations for instant switching" },
  { icon: FileCode2, label: "Per-Patch Toggles", desc: "Enable or disable individual patches within a mod" },
  { icon: Shield, label: "Pre-flight Checks", desc: "Validates game files, offsets, and conflicts before mounting" },
  { icon: ClipboardCheck, label: "Detailed Diagnostics", desc: "Full pre-mount check with version mismatch and stale backup detection" },
  { icon: Wrench, label: "Interrupted Mount Recovery", desc: "Detects and recovers from interrupted mount operations" },
  { icon: Archive, label: "Backup Manager", desc: "View, restore individual, or delete game file backups with manual backup button" },
  { icon: Camera, label: "Backup Snapshots", desc: "Save and restore named snapshots of your entire mod state" },
  { icon: Globe, label: "Language & Fonts", desc: "Dedicated section for translation patches and per-language font replacement" },
  { icon: Package, label: "Mod Packs", desc: "Bundle multiple mods into shareable .dmpack files with embedded mod data" },
  { icon: Users, label: "Community Profiles", desc: "Export and import lightweight mod checklists as .dmprofile files" },
  { icon: Hammer, label: "Mod Creator", desc: "Build new JSON byte-patch mods from scratch within the app" },
  { icon: Eye, label: "Game Version Tracking", desc: "Detects game updates and warns about mod compatibility" },
  { icon: Layers, label: "PAPGT Overlay Monitoring", desc: "Real-time monitoring of the patch group table overlay status" },
  { icon: Play, label: "Launch Game", desc: "Start Crimson Desert directly from the manager" },
  { icon: MonitorDown, label: "Auto Game Detection", desc: "Automatically finds your Crimson Desert installation across drives" },
  { icon: RefreshCw, label: "Nexus Update Checker", desc: "Checks all mods against Nexus Mods for available updates" },
  { icon: Search, label: "Nexus Name Search", desc: "Automatically finds Nexus mod IDs by searching mod names with local caching" },
  { icon: FolderPlus, label: "Multi-format Import", desc: "Import mods from JSON files, ZIP archives, or Nexus download folders" },
  { icon: Download, label: "Drag & Drop Import", desc: "Drag .json or .zip mod files onto the window to install instantly" },
  { icon: Share2, label: "Export / Import Lists", desc: "Share your mod setup and load order with other players" },
  { icon: FolderOpen, label: "Quick Folder Access", desc: "Open mods folder or game directory directly from the sidebar" },
  { icon: GripVertical, label: "Mount Status Badges", desc: "Each mod shows whether it's currently mounted in the game" },
  { icon: Terminal, label: "Activity Log", desc: "Real-time log with color-coded output for all operations" },
  { icon: RefreshCw, label: "Auto-refresh", desc: "Automatically detects new mods added to the folder every 3 seconds" },
];

const changelog = [
  {
    version: "1.0.5c",
    date: "April 2026",
    title: "File Replacement Hotfix — Encryption Flag Fix",
    changes: [
      "Fixed CSS/HTML/XML file replacement mods crashing the game — the 0x0030 flag in the base game means encryption, not file type. Overlay files now correctly use 0x0002 (plain LZ4) which the game loads without decryption",
      "No Fog of War, Better Trade Menu, Minimap Tweaks, and all other file replacement mods now work correctly through the overlay system",
    ],
  },
  {
    version: "1.0.5b",
    date: "April 2026",
    title: "File Replacement Fixes, PAZ Group Replace & ASI Folder Picker",
    changes: [
      "Fixed file replacement mods (CSS/HTML/XML) — overlay now uses correct game flags (0x0032 for UI files) so the game actually loads them",
      "PAZ group replacement — language and localization mods that replace entire PAZ groups (e.g. 0020/) are now fully supported with automatic backup and PAPGT CRC updates",
      "Custom ASI mod folder — users can now select a custom folder for ASI mods instead of defaulting to bin64",
      "Language mod folder — dedicated _language/ folder for folder-based language mods (PAZ group replacements), separate from the main mod library",
      "Import Language Mod button now accepts folders and ZIP files in addition to JSON",
      "Enable All / Disable All buttons now include texture, archive & file mods alongside JSON mods",
      "Auto-refresh now detects version changes in mod manifests, not just folder name changes",
      "Drag-and-drop now triggers language mod scan after import",
      "Standalone overlay mods (like Axiom Bracelet) now work correctly alongside other file replacement mods",
      "DDS texture overlays use correct uncompressed flags matching base game format",
    ],
  },
  {
    version: "1.0.5",
    date: "April 2026",
    title: "Game Update Resilience, Pattern Scanner & Nuclear Unmount",
    changes: [
      "Pattern scan engine — when a game update shifts byte offsets, DMM automatically scans for the original bytes and patches at the new location. Mods survive game updates without needing author updates",
      "Short-pattern support — even 2-byte patches (like inventory slot values) are relocated via windowed proximity scan (±512 bytes around the original offset)",
      "Nuclear unmount — compares bin64/ against a vanilla manifest and removes ALL non-vanilla files on unmount. ASI files are moved to staging instead of deleted",
      "Game update detection — computes SHA256 of PAPGT on startup and compares to stored hash. Automatically invalidates stale caches and refreshes backups when the game updates",
      "PAPGT validation — detects tainted PAPGT files containing overlay entries from other tools. Shows a 'Restore Vanilla' button in the sidebar",
      "Restore Vanilla command — strips 0036 overlay entry from PAPGT, removes orphaned name strings, adjusts all name offsets, and recomputes header CRC",
      "Standalone overlay mod support — mods shipping pre-built 0036/0.paz + 0036/0.pamt are auto-detected and mounted directly",
      "ASI folder detection — scans subdirectories in the mods folder for .asi files and installs them automatically",
      "Modded game warning banner — sidebar shows warning with Restore Vanilla button when PAPGT has been modified by another tool",
      "Confirmed working with Crimson Desert v1.02.00 — overlay system, JSON byte patches, texture mods, and ASI mods all verified",
    ],
  },
  {
    version: "1.0.4b",
    date: "April 2026",
    title: "Hotfix — Card Style, Unmount & Backup Fixes",
    changes: [
      "Unified card style across all mod types — JSON, ASI, texture, and archive mods now use matching checkbox cards",
      "Fixed texture/archive mods auto-enabling on startup — mods now only activate when the user toggles them",
      "Clean unmount — removes overlay files (0036/), restores PATHC, and deletes patched game files on unmount",
      "PAPGT validation — detects tainted backups with overlay entries and removes them automatically",
      "PATHC backed up on first run for clean restore on unmount",
      "Manual backup now creates visible .original files in the Backup Manager",
      "Backup list no longer shows internal DMM files (papgt_clean.bin, etc.)",
    ],
  },
  {
    version: "1.0.4",
    date: "April 2026",
    title: "Merged Mod Cards, PAPGT Detection & UI Cleanup",
    changes: [
      "Merged mod cards — texture and archive/file mods from the same folder now display as a single card with both type badges",
      "PAPGT modification detection — warns on startup if game files were modified by another tool",
      "ReShade moved to the Manage section in the sidebar for easier access",
      "Removed Snapshots section — config auto-saves and restores mod state on every change",
      "Unified mod section header: Texture, Archive & File Mods combined into one list",
    ],
  },
  {
    version: "1.0.3",
    date: "April 2026",
    title: "ASI Improvements, UI Polish & Safety",
    changes: [
      "ASI drag-and-drop — drop .asi or .dll files onto the window to install directly to bin64",
      "ASI auto-pickup — .asi files placed in the mods folder are auto-detected and installed to the game",
      "ASI mod cards redesigned to match the mod library style with accent bars, animated toggles, and status badges",
      "ASI/DLL conflict detection added to the Conflicts and Compatibility sections",
      "Sidebar icons and text enlarged for better readability",
      "ASI Mods moved above Conflicts in the sidebar navigation",
      "Titlebar name now has a gradient accent color and proper spacing",
      "Default window size increased to 1440x900 for better layout on first launch",
      "Drop overlay updated to show all supported file types (.json, .zip, .asi, .dll, folders)",
    ],
  },
  {
    version: "1.0.2",
    date: "April 2026",
    title: "Mount Fix, Update Checker & Safety Improvements",
    changes: [
      "Fixed Mount Mods button being disabled when only texture mods or archive & file mods are enabled",
      "Added automatic update checker — detects new releases on startup with one-click auto-update",
      "Already-patched detection — skips patches that are already applied, prevents double-patching corruption",
      "Original byte verification — warns when game files don't match expected state before patching",
      "Program Files warning — one-time toast on startup if the game is in a restricted write path",
      "Preset picker — mods with bracket-labeled variants like [50], [100], [150] now show radio buttons instead of individual toggles",
    ],
  },
  {
    version: "1.0.0",
    date: "April 2026",
    title: "Initial Release",
    changes: [
      "Full mod management with enable/disable toggles, drag-and-drop load ordering, and per-patch controls",
      "Multi-file PAZ overlay engine supporting ANY .pabgb game file",
      "File replacement mods — auto-detects manifest.json, mod.json, and loose folder formats",
      "PAZ replacement mods — pre-built .paz archives at any index (0.paz, 32.paz, etc.)",
      "DDS texture mod support via PATHC index with per-folder enable/disable",
      "Audio mods (.wem) — Wwise audio replacement through the file overlay pipeline",
      "Per-language font replacement (.ttf/.otf) with LZ4 compression and full checksum chain",
      "Cross-format merge — JSON byte patches applied on top of file replacement bases automatically",
      "Cross-format conflict detection and compatibility matrix across all mod types",
      "Overlay deduplication — duplicate files resolved by load order, no broken PAMT entries",
      "Script mod detection (.bat/.ps1) — flagged for manual execution",
      "Mod Packs — bundle mods into shareable .dmpack files with embedded data",
      "Backup Snapshots — save and restore named snapshots of your entire mod state",
      "Community Profiles — export and import mod checklists as lightweight .dmprofile files",
      "Mod Creator — build JSON byte-patch mods from scratch within the app",
      "Reverse-engineered PAZ/PAMT/PAPGT archive format with correct hashlittle checksums",
      "LZ4 compression pipeline — extracts from base archives, patches, recompresses, builds overlay",
      "Automatic Steam game directory detection across all drives",
      "First-startup initialization with automatic vanilla backup",
      "Pre-flight validation, detailed diagnostics, and interrupted mount recovery",
      "Mod profiles for instant switching between mod configurations",
      "Backup manager with manual backup, individual restore, and bulk restore",
      "Language & Fonts section with translation patches and font replacement",
      "ASI/DLL mod management with loader auto-install",
      "ReShade integration with preset management and toggle",
      "Nexus Mods integration — update checking and mod ID search with local caching",
      "Multi-format import — JSON, ZIP, and Nexus download folder detection",
      "Drag-and-drop mod installation",
      "Game version tracking with compatibility warnings",
      "PAPGT overlay monitoring in the status bar",
      "Real-time activity log with timestamped, color-coded entries",
      "Custom frameless window with dark theme and accent glow",
      "Standalone single exe — built with Tauri (Rust) + React + Tailwind, zero dependencies",
    ],
  },
];

export function AboutView() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/30" style={{ padding: "28px 32px 20px" }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Definitive Mod Manager</h1>
            <p className="text-sm text-text-muted mt-1">
              The modern mod manager for Crimson Desert
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout — each column scrolls independently */}
      <div className="flex-1 flex min-h-0">
          {/* Left: Features */}
          <div className="flex-1 border-r border-border/20 overflow-y-auto" style={{ padding: "24px 32px" }}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-text-muted/60" style={{ marginBottom: "20px" }}>
              Features ({features.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {features.map((f) => (
                <div key={f.label} className="flex items-start gap-4 hover:bg-white/[0.02] transition-colors" style={{ padding: "10px 12px" }}>
                  <f.icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{f.label}</p>
                    <p className="text-xs text-text-muted mt-1">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Changelog */}
          <div className="flex-1 overflow-y-auto" style={{ padding: "24px 32px" }}>
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-text-muted/60" style={{ marginBottom: "20px" }}>
              Changelog
            </h2>
            <div className="space-y-6">
              {changelog.map((release) => (
                <div key={release.version}>
                  <div className="flex items-center gap-3" style={{ marginBottom: "16px" }}>
                    <span className="text-xl font-bold text-accent font-mono">
                      v{release.version}
                    </span>
                    <span className="text-xs text-text-muted bg-white/[0.03] border border-border/40" style={{ padding: "4px 12px" }}>
                      {release.date}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-text-primary" style={{ marginBottom: "14px" }}>{release.title}</p>
                  <ul style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {release.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                        <span className="text-accent/50 mt-0.5 shrink-0">&#8226;</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Compatibility */}
            <div className="border-t border-border/20" style={{ marginTop: "32px", paddingTop: "20px" }}>
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-text-muted/60" style={{ marginBottom: "12px" }}>
                Supported Mod Formats
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">JSON byte-patch</strong> (.json) — hex patches at specific byte offsets in .pabgb game files</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">File replacement</strong> (manifest.json / mod.json + files/) — full file overrides organized by PAZ group</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">Loose folder</strong> — numbered group directories (0000–0036) auto-detected without any manifest</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">PAZ replacement</strong> — pre-built .paz archives at any index (0.paz, 1.paz, 32.paz, etc.)</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">DDS textures</strong> — folder-based texture replacements registered in the PATHC index</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">Font mods</strong> (.ttf / .otf) — per-language game font replacement via PAZ overlay</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">Audio mods</strong> (.wem) — Wwise audio file replacement through the overlay pipeline</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">UI mods</strong> (.css / .xml / .html) — game interface modifications via file replacement</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">ASI / DLL plugins</strong> — native code mods with ASI Loader auto-install</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">ReShade presets</strong> — post-processing shader management with preset switching</span>
                </p>
                <p className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&#8226;</span>
                  <span><strong className="text-text-primary">Script mods</strong> (.bat / .ps1) — detected and flagged for manual execution</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/20" style={{ marginTop: "24px", paddingTop: "20px" }}>
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                Built with <Heart className="w-3 h-3 text-danger" /> using Tauri + React + Rust
              </p>
            </div>
          </div>
      </div>
    </div>
  );
}
