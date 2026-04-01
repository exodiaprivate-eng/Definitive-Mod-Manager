import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plug, Settings2, Trash2, Download, AlertTriangle, Check } from "lucide-react";
import type { AsiStatus } from "@/types";

interface AsiModViewProps {
  asiStatus: AsiStatus | null;
  onRefresh: () => void;
  onEnable: (name: string) => void;
  onDisable: (name: string) => void;
  onInstall: () => void;
  onUninstall: (name: string) => void;
  onOpenConfig: (name: string) => void;
  onInstallLoader: () => void;
  installingLoader?: boolean;
}

export function AsiModView({
  asiStatus,
  onRefresh,
  onEnable,
  onDisable,
  onInstall,
  onUninstall,
  onOpenConfig,
  onInstallLoader,
  installingLoader = false,
}: AsiModViewProps) {
  const plugins = asiStatus?.plugins ?? [];
  const enabledCount = plugins.filter((p) => p.enabled).length;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">ASI / DLL Mods</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Native plugin mods loaded by ASI Loader &middot;{" "}
              {plugins.length > 0
                ? `${enabledCount} active / ${plugins.length} total`
                : "No plugins detected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-sm hover:bg-surface-hover hover:border-border-hover transition-all"
            >
              Refresh
            </button>
            <button
              onClick={onInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-sm hover:bg-surface-hover hover:border-border-hover transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Install ASI Mod
            </button>
          </div>
        </div>
      </div>

      {/* ASI Loader status banner */}
      <div style={{ padding: "0 16px 12px 16px" }}>
        {asiStatus ? (
          asiStatus.has_loader ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-success/10 border border-success/20">
              <Check className="w-4 h-4 text-success shrink-0" />
              <span className="text-xs font-medium text-success">
                ASI Loader detected: {asiStatus.loader_name}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm bg-warning/10 border border-warning/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                <span className="text-xs font-medium text-warning">
                  No ASI Loader detected. ASI mods require one to function.
                </span>
              </div>
              <button
                onClick={onInstallLoader}
                disabled={installingLoader}
                style={{ padding: "4px 12px", fontSize: "11px" }}
                className={cn(
                  "flex items-center gap-1.5 font-medium rounded-sm shrink-0 transition-all",
                  installingLoader
                    ? "bg-white/5 text-text-muted cursor-not-allowed border border-border"
                    : "bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25"
                )}
              >
                <Download className="w-3 h-3" />
                {installingLoader ? "Installing..." : "Install Loader"}
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/5 border border-border">
            <span className="text-xs text-text-muted">
              Set a valid game path to scan for ASI mods.
            </span>
          </div>
        )}
      </div>

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {plugins.length > 0 ? (
          <div className="space-y-2">
            {plugins.map((plugin) => (
              <motion.div
                key={plugin.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-sm border p-4 transition-all duration-200",
                  plugin.enabled
                    ? "bg-accent-muted border-accent/20 shadow-[0_0_20px_rgba(99,102,241,0.06)]"
                    : "bg-surface border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Toggle switch */}
                  <button
                    onClick={() =>
                      plugin.enabled
                        ? onDisable(plugin.name)
                        : onEnable(plugin.name)
                    }
                    className={cn(
                      "relative w-9 h-5 rounded-sm transition-colors duration-200 shrink-0",
                      plugin.enabled ? "bg-accent" : "bg-white/10"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-sm bg-white transition-all duration-200",
                        plugin.enabled ? "left-[18px]" : "left-0.5"
                      )}
                    />
                  </button>

                  {/* Plugin icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-sm flex items-center justify-center shrink-0",
                      plugin.enabled ? "bg-accent/20" : "bg-surface-active"
                    )}
                  >
                    <Plug className="w-4 h-4 text-accent" />
                  </div>

                  {/* Plugin info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {plugin.name}
                    </h3>
                    <p className="text-xs text-text-muted truncate">
                      {plugin.file_name}
                      {plugin.enabled ? (
                        <span className="ml-2 text-accent">enabled</span>
                      ) : (
                        <span className="ml-2 text-text-muted">disabled</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {plugin.has_ini && (
                      <button
                        onClick={() => onOpenConfig(plugin.name)}
                        title="Open config"
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-secondary bg-white/[0.04] border border-border rounded-sm hover:bg-white/[0.08] hover:border-border-hover transition-all"
                      >
                        <Settings2 className="w-3 h-3" />
                        Config
                      </button>
                    )}
                    <button
                      onClick={() => onUninstall(plugin.name)}
                      title="Uninstall"
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-sm hover:bg-danger/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      Uninstall
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center mt-12 text-text-muted">
            <Plug className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No ASI plugins found</p>
            <p className="text-xs mt-1">
              Install .asi mods into the game's bin64/ directory
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
