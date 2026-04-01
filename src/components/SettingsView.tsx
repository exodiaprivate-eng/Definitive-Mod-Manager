import { FolderOpen, Check, AlertCircle, HardDrive, RefreshCw, Globe, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsViewProps {
  gamePath: string;
  modsPath: string;
  gamePathValid: boolean;
  onGamePathChange: (path: string) => void;
  onModsPathChange: (path: string) => void;
  onBrowseGamePath: () => void;
  onBrowseModsPath: () => void;
  nexusApiKey: string;
  onNexusApiKeyChange: (key: string) => void;
  onCheckUpdates: () => void;
  checkingUpdates?: boolean;
  outdatedCount?: number;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export function SettingsView({
  gamePath,
  modsPath,
  gamePathValid,
  onGamePathChange,
  onModsPathChange,
  onBrowseGamePath,
  onBrowseModsPath,
  onCheckUpdates,
  checkingUpdates = false,
  outdatedCount = 0,
  theme = "dark",
  onToggleTheme,
}: SettingsViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0" style={{ padding: "28px 32px 20px" }}>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-2">Configure game and mod paths</p>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: "0 32px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Game Path */}
          <div className="border border-border bg-surface" style={{ padding: "20px" }}>
            <div className="flex items-center gap-3" style={{ marginBottom: "12px" }}>
              <HardDrive className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-text-primary">Game Installation</h2>
              {gamePathValid ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-muted rounded-sm" style={{ padding: "3px 10px" }}>
                  <Check className="w-3.5 h-3.5" /> Detected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-danger bg-danger-muted rounded-sm" style={{ padding: "3px 10px" }}>
                  <AlertCircle className="w-3.5 h-3.5" /> Not Found
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted" style={{ marginBottom: "12px" }}>
              Path to the Crimson Desert installation folder
            </p>
            <div className="flex items-center" style={{ gap: "10px" }}>
              <div
                className="flex items-center flex-1 bg-background border border-border rounded-sm focus-within:border-accent/50 transition-all"
                style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}
              >
                <HardDrive className="w-4 h-4 text-text-muted/50 shrink-0" />
                <input
                  type="text"
                  value={gamePath}
                  onChange={(e) => onGamePathChange(e.target.value)}
                  placeholder="C:\Program Files (x86)\Steam\steamapps\common\Crimson Desert"
                  className="flex-1 h-full bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
              <button
                onClick={onBrowseGamePath}
                style={{ padding: "8px 16px", fontSize: "13px" }}
                className="flex items-center gap-2 font-medium text-text-secondary bg-surface-hover border border-border rounded-sm hover:bg-surface-active hover:border-border-hover transition-all"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
          </div>

          {/* Mods Path */}
          <div className="border border-border bg-surface" style={{ padding: "20px" }}>
            <div className="flex items-center gap-3" style={{ marginBottom: "12px" }}>
              <FolderOpen className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-text-primary">Mods Folder</h2>
            </div>
            <p className="text-sm text-text-muted" style={{ marginBottom: "12px" }}>
              Directory where mod JSON files are stored
            </p>
            <div className="flex items-center" style={{ gap: "10px" }}>
              <div
                className="flex items-center flex-1 bg-background border border-border rounded-sm focus-within:border-accent/50 transition-all"
                style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}
              >
                <FolderOpen className="w-4 h-4 text-text-muted/50 shrink-0" />
                <input
                  type="text"
                  value={modsPath}
                  onChange={(e) => onModsPathChange(e.target.value)}
                  placeholder="Path to mods folder"
                  className="flex-1 h-full bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
              <button
                onClick={onBrowseModsPath}
                style={{ padding: "8px 16px", fontSize: "13px" }}
                className="flex items-center gap-2 font-medium text-text-secondary bg-surface-hover border border-border rounded-sm hover:bg-surface-active hover:border-border-hover transition-all"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
          </div>

          {/* Nexus Mods Integration */}
          <div className="border border-border bg-surface" style={{ padding: "20px" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-accent" />
                <h2 className="text-base font-semibold text-text-primary">Nexus Mods Integration</h2>
                <span className="flex items-center gap-1 text-xs font-medium text-success bg-success-muted rounded-sm" style={{ padding: "3px 10px" }}>
                  <Check className="w-3.5 h-3.5" /> Connected
                </span>
              </div>
              <div className="flex items-center" style={{ gap: "10px" }}>
                {outdatedCount > 0 && (
                  <span className="text-xs font-bold text-danger bg-danger/10 border border-danger/20 rounded-sm" style={{ padding: "4px 10px" }}>
                    {outdatedCount} update{outdatedCount !== 1 ? "s" : ""} available
                  </span>
                )}
                <button
                  onClick={onCheckUpdates}
                  disabled={checkingUpdates}
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                  className={cn(
                    "flex items-center gap-2 font-medium border rounded-sm transition-all",
                    !checkingUpdates
                      ? "text-accent bg-accent/10 border-accent/20 hover:bg-accent/20"
                      : "text-text-muted bg-surface-hover border-border cursor-not-allowed"
                  )}
                >
                  <RefreshCw className={cn("w-4 h-4", checkingUpdates && "animate-spin")} />
                  {checkingUpdates ? "Checking..." : "Check for Updates"}
                </button>
              </div>
            </div>
            <p className="text-sm text-text-muted" style={{ marginTop: "12px" }}>
              Automatically checks installed mods against Nexus Mods for available updates
            </p>
          </div>

          {/* Theme */}
          <div className="border border-border bg-surface" style={{ padding: "20px" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-accent" />}
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Appearance</h2>
                  <p className="text-sm text-text-muted mt-1">Currently using <span className="text-text-secondary font-semibold">{theme}</span> mode</p>
                </div>
              </div>
              <button
                onClick={onToggleTheme}
                style={{ padding: "8px 16px", fontSize: "13px" }}
                className="flex items-center gap-2 font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                Switch to {theme === "dark" ? "Light" : "Dark"} Mode
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="border border-border bg-surface" style={{ padding: "20px" }}>
            <h2 className="text-base font-semibold text-text-primary" style={{ marginBottom: "12px" }}>How It Works</h2>
            <div className="text-sm text-text-secondary leading-relaxed" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <p>
                Mods are JSON files that describe binary patches to game data files.
                Each patch specifies a byte offset and the hex values to write.
              </p>
              <p>
                When you click <strong className="text-text-primary">Mount Mods</strong>, the manager
                backs up original files, then applies patches from enabled mods in load order.
              </p>
              <p>
                <strong className="text-text-primary">Unmount Mods</strong> restores all game files
                from backups to their original state.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
