import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Paintbrush, Settings2, Check, AlertTriangle, Layers, Eye } from "lucide-react";
import type { ReshadeStatus } from "@/types";

interface ReshadeViewProps {
  reshadeStatus: ReshadeStatus | null;
  onRefresh: () => void;
  onToggle: (enable: boolean) => void;
  onSetPreset: (presetName: string) => void;
  onOpenConfig: () => void;
}

export function ReshadeView({
  reshadeStatus,
  onRefresh,
  onToggle,
  onSetPreset,
  onOpenConfig,
}: ReshadeViewProps) {
  const presets = reshadeStatus?.presets ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">ReShade</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Post-processing shader injector &middot;{" "}
              {reshadeStatus?.installed
                ? reshadeStatus.enabled
                  ? "Active"
                  : "Disabled"
                : "Not detected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-sm hover:bg-surface-hover hover:border-border-hover transition-all"
            >
              Refresh
            </button>
            {reshadeStatus?.installed && reshadeStatus.has_config && (
              <button
                onClick={onOpenConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-sm hover:bg-surface-hover hover:border-border-hover transition-all"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Open Config
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div style={{ padding: "0 16px 12px 16px" }}>
        {reshadeStatus ? (
          reshadeStatus.installed ? (
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-sm border",
                reshadeStatus.enabled
                  ? "bg-success/10 border-success/20"
                  : "bg-warning/10 border-warning/20"
              )}
            >
              {reshadeStatus.enabled ? (
                <Check className="w-4 h-4 text-success shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  reshadeStatus.enabled ? "text-success" : "text-warning"
                )}
              >
                {reshadeStatus.enabled
                  ? `ReShade active via ${reshadeStatus.dll_name}`
                  : `ReShade disabled (${reshadeStatus.dll_name}.disabled)`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/5 border border-border">
              <AlertTriangle className="w-4 h-4 text-text-muted shrink-0" />
              <span className="text-xs text-text-muted">
                ReShade not detected in bin64/. Install ReShade manually, then
                manage it here.
              </span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/5 border border-border">
            <span className="text-xs text-text-muted">
              Set a valid game path to scan for ReShade.
            </span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {reshadeStatus?.installed ? (
          <div className="space-y-4">
            {/* Toggle card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-sm border p-4 transition-all duration-200",
                reshadeStatus.enabled
                  ? "bg-accent-muted border-accent/20 shadow-[0_0_20px_rgba(99,102,241,0.06)]"
                  : "bg-surface border-border"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Toggle switch */}
                <button
                  onClick={() => onToggle(!reshadeStatus.enabled)}
                  className={cn(
                    "relative w-9 h-5 rounded-sm transition-colors duration-200 shrink-0",
                    reshadeStatus.enabled ? "bg-accent" : "bg-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-sm bg-white transition-all duration-200",
                      reshadeStatus.enabled ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </button>

                {/* Icon */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-sm flex items-center justify-center shrink-0",
                    reshadeStatus.enabled ? "bg-accent/20" : "bg-surface-active"
                  )}
                >
                  <Paintbrush className="w-4 h-4 text-accent" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">
                    ReShade {reshadeStatus.enabled ? "Enabled" : "Disabled"}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {reshadeStatus.dll_name && (
                      <span>DLL: {reshadeStatus.dll_name}</span>
                    )}
                    {reshadeStatus.shader_count > 0 && (
                      <span className="ml-2">
                        &middot; {reshadeStatus.shader_count} shader
                        {reshadeStatus.shader_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Info row */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-sm border border-border bg-surface p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs font-medium text-text-secondary">
                    Shaders
                  </span>
                </div>
                <p className="text-lg font-bold text-text-primary">
                  {reshadeStatus.shader_count}
                </p>
                <p className="text-[10px] text-text-muted">
                  .fx files in reshade-shaders/Shaders/
                </p>
              </div>
              <div className="flex-1 rounded-sm border border-border bg-surface p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs font-medium text-text-secondary">
                    Active Preset
                  </span>
                </div>
                <p className="text-sm font-bold text-text-primary truncate">
                  {reshadeStatus.active_preset ?? "None"}
                </p>
                <p className="text-[10px] text-text-muted">
                  Set in reshade.ini PresetPath
                </p>
              </div>
            </div>

            {/* Presets */}
            {presets.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted/60 mb-3">
                  Presets ({presets.length})
                </p>
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <motion.button
                      key={preset.file_name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => onSetPreset(preset.file_name)}
                      className={cn(
                        "w-full text-left rounded-sm border p-3 transition-all duration-200",
                        preset.is_active
                          ? "bg-accent-muted border-accent/20 shadow-[0_0_20px_rgba(99,102,241,0.06)]"
                          : "bg-surface border-border hover:bg-surface-hover hover:border-border-hover"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-sm flex items-center justify-center shrink-0",
                            preset.is_active
                              ? "bg-accent/20"
                              : "bg-surface-active"
                          )}
                        >
                          <Paintbrush className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-text-primary truncate">
                            {preset.name}
                          </h4>
                          <p className="text-xs text-text-muted truncate">
                            {preset.file_name}
                            {preset.is_active && (
                              <span className="ml-2 text-accent">active</span>
                            )}
                          </p>
                        </div>
                        {preset.is_active && (
                          <Check className="w-4 h-4 text-accent shrink-0" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center mt-12 text-text-muted">
            <Paintbrush className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">ReShade not installed</p>
            <p className="text-xs mt-1">
              Install ReShade into the game's bin64/ directory, then manage it
              here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
