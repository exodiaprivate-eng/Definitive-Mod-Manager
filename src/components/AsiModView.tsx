import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plug, Settings2, Trash2, Download, AlertTriangle, Check, RefreshCw, GripVertical } from "lucide-react";
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
      <div className="shrink-0 px-8 pt-7 pb-5" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-bold text-text-primary">ASI / DLL Mods</h1>
          </div>
          <div className="flex items-center" style={{ gap: "10px" }}>
            <button
              onClick={onRefresh}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
            <button
              onClick={onInstall}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
            >
              <Download className="w-5 h-5" />
              Install ASI Mod
            </button>
          </div>
        </div>

        {/* Summary + Loader status */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">
            {plugins.length > 0
              ? <><span className="text-text-secondary font-semibold">{enabledCount}</span> active of {plugins.length} plugin{plugins.length !== 1 ? "s" : ""}</>
              : "No plugins detected"}
          </span>
          <div className="flex-1" />
          {asiStatus && (
            asiStatus.has_loader ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-success/10 border border-success/20">
                <Check className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="text-xs font-medium text-success">
                  Loader: {asiStatus.loader_name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-sm bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                  <span className="text-xs font-medium text-warning">No ASI Loader</span>
                </div>
                <button
                  onClick={onInstallLoader}
                  disabled={installingLoader}
                  style={{ padding: "3px 10px", fontSize: "11px" }}
                  className={cn(
                    "flex items-center gap-1.5 font-medium rounded-sm shrink-0 transition-all",
                    installingLoader
                      ? "bg-white/5 text-text-muted cursor-not-allowed border border-border"
                      : "bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25"
                  )}
                >
                  <Download className="w-3 h-3" />
                  {installingLoader ? "Installing..." : "Install"}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {plugins.length > 0 ? (
          <div className="space-y-3">
            {plugins.map((plugin, index) => (
              <motion.div
                key={plugin.name}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "group rounded-sm border relative overflow-hidden transition-all",
                  plugin.enabled
                    ? "bg-gradient-to-r from-accent/10 via-surface to-surface border-accent/25 shadow-[0_0_25px_rgba(99,102,241,0.08)]"
                    : "bg-surface/80 border-border/60 hover:border-border-hover"
                )}
              >
                {/* Left accent bar */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                  plugin.enabled
                    ? "bg-gradient-to-b from-accent to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    : "bg-border/30 group-hover:bg-text-muted/30"
                )} />

                <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                  {/* Load order number */}
                  <div className={cn(
                    "w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                    plugin.enabled
                      ? "bg-accent/20 text-accent border border-accent/20"
                      : "bg-white/[0.03] text-text-muted border border-border/40"
                  )}>
                    {index + 1}
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => plugin.enabled ? onDisable(plugin.name) : onEnable(plugin.name)}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-all duration-300 shrink-0",
                      plugin.enabled
                        ? "bg-accent shadow-[0_0_12px_rgba(99,102,241,0.5),inset_0_1px_2px_rgba(0,0,0,0.2)]"
                        : "bg-white/[0.06] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
                    )}
                  >
                    <motion.div
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full shadow-md",
                        plugin.enabled ? "bg-white" : "bg-text-muted"
                      )}
                      animate={{ left: plugin.enabled ? 28 : 4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className={cn(
                        "text-base font-semibold truncate transition-colors",
                        plugin.enabled ? "text-text-primary" : "text-text-secondary"
                      )}>
                        {plugin.name}
                      </h3>
                      <span className={cn(
                        "text-[11px] font-mono px-2.5 py-0.5 rounded-sm border",
                        plugin.enabled
                          ? "bg-accent/10 text-accent/80 border-accent/15"
                          : "bg-white/[0.02] text-text-muted border-border/40"
                      )}>
                        {plugin.file_name.toLowerCase().endsWith(".asi") ? "asi" : "dll"}
                      </span>
                      {plugin.enabled ? (
                        <span className="text-xs font-medium text-success border border-success/25 bg-success/10 rounded-sm" style={{ padding: "2px 8px" }}>
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-text-muted border border-border/30 bg-white/[0.02] rounded-sm" style={{ padding: "2px 8px" }}>
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-5 mt-2">
                      <span className="flex items-center gap-2 text-sm text-text-muted">
                        <Plug className="w-3.5 h-3.5" />
                        {plugin.file_name}
                      </span>
                      {plugin.has_ini && (
                        <span className="text-sm text-text-muted">
                          Has config file
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {plugin.has_ini && (
                    <button
                      onClick={() => onOpenConfig(plugin.name)}
                      title="Open config"
                      style={{ padding: "8px 14px", fontSize: "12px" }}
                      className="flex items-center gap-2 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
                    >
                      <Settings2 className="w-4 h-4" />
                      Config
                    </button>
                  )}
                  <button
                    onClick={() => onUninstall(plugin.name)}
                    title="Uninstall"
                    className="p-2.5 rounded-sm text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Plug className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No ASI plugins found</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Drag .asi files onto the window or click Install ASI Mod
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
