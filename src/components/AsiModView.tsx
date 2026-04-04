import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plug, Settings2, Trash2, Download, AlertTriangle, Check, RefreshCw } from "lucide-react";
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
                  "group rounded-sm border relative overflow-hidden transition-all cursor-pointer",
                  plugin.enabled
                    ? "bg-accent/[0.03] border-accent/30 hover:border-accent/50"
                    : "bg-surface/80 border-border/60 hover:border-border-hover"
                )}
                onClick={() => plugin.enabled ? onDisable(plugin.name) : onEnable(plugin.name)}
              >
                {/* Left accent bar */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                  plugin.enabled ? "bg-accent/70" : "bg-border/30 group-hover:bg-accent/50"
                )} />

                <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); plugin.enabled ? onDisable(plugin.name) : onEnable(plugin.name); }}
                    className={cn(
                      "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                      plugin.enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
                    )}
                  >
                    {plugin.enabled && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  {/* Icon */}
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                    <Plug className={cn("w-4 h-4", plugin.enabled ? "text-accent" : "text-text-muted")} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
                    <div className="flex items-center gap-3">
                      <h3 className={cn(
                        "text-base font-semibold truncate transition-colors",
                        plugin.enabled ? "text-text-primary" : "text-text-secondary"
                      )}>
                        {plugin.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-5 mt-1.5">
                      <span className="text-sm text-text-muted">
                        {plugin.file_name}
                      </span>
                      {plugin.has_ini && (
                        <span className="text-sm text-text-muted">
                          Has config file
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type badge */}
                  <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                    {plugin.file_name.toLowerCase().endsWith(".asi") ? "asi" : "dll"}
                  </span>

                  {/* Actions */}
                  {plugin.has_ini && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenConfig(plugin.name); }}
                      title="Open config"
                      style={{ padding: "8px 14px", fontSize: "12px" }}
                      className="flex items-center gap-2 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
                    >
                      <Settings2 className="w-4 h-4" />
                      Config
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onUninstall(plugin.name); }}
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
