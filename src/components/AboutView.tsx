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
} from "lucide-react";

const features = [
  { icon: Blocks, label: "Mod Management", desc: "Enable, disable, and reorder mods with drag-and-drop load ordering" },
  { icon: Rocket, label: "Mount / Unmount", desc: "One-click mounting with automatic backup — always patches from clean vanilla" },
  { icon: Package, label: "Multi-File Patching", desc: "Supports mods targeting ANY .pabgb game file (storeinfo, inventory, recipes, etc.)" },
  { icon: Layers, label: "PAZ Overlay System", desc: "Reverse-engineered Pearl Abyss archive format — builds game-compatible overlays" },
  { icon: AlertTriangle, label: "Conflict Detection", desc: "Warns when multiple mods patch the same byte offset" },
  { icon: Bookmark, label: "Mod Profiles", desc: "Save and load named mod configurations for instant switching" },
  { icon: FileCode2, label: "Per-Patch Toggles", desc: "Enable or disable individual patches within a mod" },
  { icon: Shield, label: "Pre-flight Checks", desc: "Validates game files, offsets, and conflicts before mounting" },
  { icon: ClipboardCheck, label: "Detailed Diagnostics", desc: "Full pre-mount check with version mismatch and stale backup detection" },
  { icon: Wrench, label: "Interrupted Mount Recovery", desc: "Detects and recovers from interrupted mount operations" },
  { icon: Archive, label: "Backup Manager", desc: "View, restore individual, or delete game file backups" },
  { icon: Globe, label: "Language Mods", desc: "Dedicated section for translation and localization patches" },
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
    version: "1.0.2",
    date: "April 2026",
    title: "Feature Expansion Update",
    changes: [
      "Mod Packs — bundle multiple mods into shareable packs with embedded mod data",
      "Backup Snapshots — save and restore named snapshots of your entire mod state",
      "Compatibility Matrix — view pairwise compatibility between all installed mods",
      "Mod Creator — build new JSON byte-patch mods from scratch within the app",
      "Community Profiles — export and import full mod configurations for sharing",
      "Nexus Browse — search and discover mods on Nexus Mods directly from the manager",
      "Manual Backup button — create backups on demand from the Backups tab",
      "Mod deletion — remove mod files directly from the mod list",
      "Nexus API key loaded from file — no hardcoded credentials",
      "Fixed profile save/load crash caused by serialization mismatch",
      "Fixed drag-and-drop overlay getting stuck on cancel",
      "ASI Loader download URL updated to latest release",
    ],
  },
  {
    version: "1.0.0",
    date: "March 2026",
    title: "Initial Release",
    changes: [
      "Full mod management with enable/disable toggles and drag-and-drop load ordering",
      "Multi-file PAZ overlay engine — supports ANY .pabgb game file (storeinfo, inventory, recipes, etc.)",
      "Reverse-engineered Pearl Abyss PAZ/PAMT/PAPGT archive format with correct hashlittle checksums",
      "LZ4 compression pipeline — extracts from base archives, patches, recompresses, builds overlay",
      "Automatic PAMT generation with multi-file directory tree, filename blocks, and hash entries",
      "PAPGT builder with correct integrity hashes (Bob Jenkins hashlittle, init=0xC5EDE)",
      "Automatic Steam game directory detection across C:, D:, E: drives",
      "First-startup initialization — creates mods/backups folders, backs up vanilla game files",
      "Automatic extraction of clean game data from PAZ archives on first mount",
      "Conflict detection — warns when two mods modify the same byte offset",
      "Pre-flight validation — checks game files, offset bounds, and conflicts before mount",
      "Detailed diagnostics — version mismatch detection, stale backup warnings, full status report",
      "Interrupted mount recovery — detects and fixes broken state from interrupted operations",
      "Mod profiles — save, load, and delete named mod configurations for instant switching",
      "Per-patch toggles — enable or disable individual patches within a mod",
      "Mount status badges — each mod card shows if it's currently mounted in the game",
      "Backup manager — view all backups, restore individual files, or bulk restore",
      "Language mod support — dedicated section for translation patches",
      "Game version tracking — reads paver file and warns when game updates may break mods",
      "PAPGT overlay monitoring — real-time status bar showing overlay group state",
      "Launch game directly from the manager",
      "Nexus Mods integration — checks installed mods for available updates via API",
      "Nexus name search — finds mod IDs by searching mod names with local result caching",
      "Multi-format import — JSON files, ZIP archives, and Nexus download folder detection",
      "Drag-and-drop mod installation — drop .json or .zip files onto the window",
      "Quick folder access — open mods folder or game directory from sidebar buttons",
      "Export/import mod lists — share your setup with SHA-256 hash verification",
      "Auto-refresh — polls the mods folder every 3 seconds for new or removed mods",
      "Real-time activity log with timestamped, color-coded entries",
      "Custom frameless window with dark theme, accent glow line, and sharp UI",
      "Built with Tauri (Rust) + React + Tailwind — compact binary vs 67MB alternatives",
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

      {/* Two-column layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-0 min-h-full">
          {/* Left: Features */}
          <div className="flex-1 border-r border-border/20" style={{ padding: "24px 32px" }}>
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
          <div className="flex-1" style={{ padding: "24px 32px" }}>
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

            {/* Footer */}
            <div className="border-t border-border/20" style={{ marginTop: "32px", paddingTop: "20px" }}>
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                Built with <Heart className="w-3 h-3 text-danger" /> using Tauri + React + Rust
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
