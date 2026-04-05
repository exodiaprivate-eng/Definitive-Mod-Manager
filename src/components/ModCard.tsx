import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileCode2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  GripVertical,
  Trash2,
  Check,
} from "lucide-react";
import { useState } from "react";
import type { ModEntry, ModChange } from "@/types";

interface PatchDetail {
  game_file: string;
  changes: ModChange[];
}

interface ModCardProps {
  mod: ModEntry;
  index: number;
  onToggle: (fileName: string) => void;
  dragHandleProps?: Record<string, unknown>;
  disabledIndices?: number[];
  onTogglePatch?: (fileName: string, patchIndex: number) => void;
  details?: PatchDetail[] | null;
  onExpand?: (fileName: string) => void;
  isMounted?: boolean;
  onDelete?: (fileName: string) => void;
}

export function ModCard({ mod, index, onToggle, dragHandleProps, disabledIndices = [], onTogglePatch, details, onExpand, isMounted, onDelete }: ModCardProps) {
  const [expanded, setExpanded] = useState(false);

  function handleExpandToggle() {
    if (!expanded && onExpand) {
      onExpand(mod.file_name);
    }
    setExpanded(!expanded);
  }

  function formatHex(offset: number): string {
    return "0x" + offset.toString(16).toUpperCase();
  }

  // Build a flat list of all patches with a global index for toggle tracking
  const allPatches: { gameFile: string; change: ModChange; globalIndex: number }[] = [];
  if (details) {
    let idx = 0;
    for (const patch of details) {
      for (const change of patch.changes) {
        allPatches.push({ gameFile: patch.game_file, change, globalIndex: idx });
        idx++;
      }
    }
  }

  // Detect bracket-labeled preset groups like [50], [100], [150]
  const bracketRegex = /^\[([^\]]+)\]/;
  const presetGroups: Record<string, { label: string; indices: number[] }[]> = {};
  let hasPresets = false;
  for (const p of allPatches) {
    const match = p.change.label.match(bracketRegex);
    if (match) {
      const groupKey = match[1];
      if (!presetGroups[groupKey]) {
        presetGroups[groupKey] = [];
      }
      // Find or create entry for this preset value
      const cleanLabel = p.change.label.replace(bracketRegex, "").trim();
      const existing = presetGroups[groupKey].find((e) => e.label === cleanLabel);
      if (existing) {
        existing.indices.push(p.globalIndex);
      } else {
        presetGroups[groupKey] = [...(presetGroups[groupKey] || []), { label: cleanLabel || groupKey, indices: [p.globalIndex] }];
      }
      hasPresets = true;
    }
  }
  // Only treat as presets if there are 2+ groups (otherwise just show normal toggles)
  const isPresetMode = hasPresets && Object.keys(presetGroups).length >= 2;
  // Find which preset group is currently active (all its indices are NOT disabled)
  const activePresetKey = isPresetMode
    ? Object.keys(presetGroups).find((key) =>
        presetGroups[key].every((entry) => entry.indices.every((i) => !disabledIndices.includes(i)))
      ) || null
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "card-lift group rounded-sm border relative overflow-hidden",
        mod.enabled
          ? "bg-gradient-to-r from-accent/10 via-surface to-surface border-accent/25 shadow-[0_0_25px_rgba(99,102,241,0.08)]"
          : "bg-surface/80 border-border/60 hover:border-border-hover"
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
        mod.enabled
          ? "bg-gradient-to-b from-accent to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          : "bg-border/30 group-hover:bg-text-muted/30"
      )} />

      <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex items-center text-text-muted/40 hover:text-text-muted cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onToggle(mod.file_name)}
          className={cn(
            "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
            mod.enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
          )}
        >
          {mod.enabled && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Icon */}
        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
          <FileCode2 className={cn("w-4 h-4", mod.enabled ? "text-accent" : "text-text-muted")} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
          <div className="flex items-center gap-3">
            <h3 className={cn(
              "text-base font-semibold truncate transition-colors",
              mod.enabled ? "text-text-primary" : "text-text-secondary"
            )}>
              {mod.title}
            </h3>
            {/* Version badge */}
            {mod.version && (
              <span className={cn(
                "text-xs font-mono shrink-0 border rounded-sm",
                mod.enabled
                  ? "text-accent/80 bg-accent/10 border-accent/15"
                  : "text-text-muted bg-white/[0.02] border-border/40"
              )} style={{ padding: "3px 10px" }}>
                v{mod.version}
              </span>
            )}
            {mod.has_conflicts && (
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
            )}
          </div>
          <div className="flex items-center gap-5 mt-1.5">
            <span className="text-sm text-text-muted">
              by {mod.author}
            </span>
            <span className="text-sm text-text-muted">
              <span className={cn("font-semibold", mod.enabled ? "text-accent" : "text-text-secondary")}>{mod.patch_count}</span> patch{mod.patch_count !== 1 ? "es" : ""}
            </span>
            {mod.description && (
              <span className="text-xs text-text-muted/70 truncate">{mod.description}</span>
            )}
          </div>
        </div>

        {/* Type + mount badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
            json patch
          </span>
          {mod.enabled && isMounted !== undefined && (
            isMounted ? (
              <span className="text-[11px] font-mono text-success bg-success/10 px-2.5 py-1 rounded-sm border border-success/25">
                mounted
              </span>
            ) : (
              <span className="text-[11px] font-mono text-warning bg-warning/10 px-2.5 py-1 rounded-sm border border-warning/25">
                not mounted
              </span>
            )
          )}
        </div>

        {/* Delete */}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(mod.file_name); }}
            className="p-2.5 rounded-sm text-text-muted/40 hover:text-danger hover:bg-danger/10 transition-all"
            title="Delete mod"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Expand */}
        <button
          onClick={handleExpandToggle}
          className="p-2.5 rounded-sm text-text-muted/40 hover:text-text-secondary hover:bg-white/[0.04] transition-all"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-border/30"
          style={{ paddingLeft: "32px", paddingRight: "32px", paddingBottom: "20px" }}
        >
          <div className="pt-4 space-y-3">
            {mod.description && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {mod.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {mod.game_files.map((file) => (
                <span
                  key={file}
                  className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-3 py-1.5 rounded-sm border border-border/30"
                >
                  {file}
                </span>
              ))}
            </div>

            {/* Preset picker (radio buttons) for bracket-labeled variants */}
            {isPresetMode && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted/60 mb-2">
                  Preset Options
                </p>
                {Object.entries(presetGroups).map(([key, entries]) => {
                  const isActive = activePresetKey === key;
                  return (
                    <div
                      key={key}
                      onClick={() => {
                        if (!onTogglePatch) return;
                        // Disable all preset indices first, then enable this group's
                        const allPresetIndices = Object.values(presetGroups).flat().flatMap((e) => e.indices);
                        for (const idx of allPresetIndices) {
                          if (!disabledIndices.includes(idx)) {
                            onTogglePatch(mod.file_name, idx);
                          }
                        }
                        // Enable this group's indices (they were just disabled above)
                        setTimeout(() => {
                          for (const entry of entries) {
                            for (const idx of entry.indices) {
                              onTogglePatch(mod.file_name, idx);
                            }
                          }
                        }, 0);
                      }}
                      style={{ padding: "10px 16px", cursor: "pointer" }}
                      className={cn(
                        "flex items-center gap-3 rounded-sm border transition-all",
                        isActive
                          ? "bg-accent/[0.06] border-accent/30"
                          : "bg-white/[0.01] border-border/30 opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        isActive ? "border-accent" : "border-border/60"
                      )}>
                        {isActive && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <span className={cn("text-sm flex-1", isActive ? "text-text-primary font-medium" : "text-text-secondary")}>
                        {key}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Per-patch toggles (standard mode) */}
            {allPatches.length > 0 && !isPresetMode && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted/60 mb-2">
                  Individual Patches
                </p>
                {allPatches.map(({ change, globalIndex }) => {
                  const isDisabled = disabledIndices.includes(globalIndex);
                  return (
                    <div
                      key={globalIndex}
                      style={{ padding: "10px 16px" }}
                      className={cn(
                        "flex items-center gap-3 rounded-sm border transition-all",
                        isDisabled
                          ? "bg-white/[0.01] border-border/30 opacity-60"
                          : "bg-white/[0.02] border-border/40"
                      )}
                    >
                      {/* Mini toggle */}
                      <button
                        onClick={() => onTogglePatch?.(mod.file_name, globalIndex)}
                        className={cn(
                          "relative w-8 h-4 rounded-full transition-all duration-300 shrink-0",
                          !isDisabled
                            ? "bg-accent shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                            : "bg-white/[0.06]"
                        )}
                      >
                        <motion.div
                          className={cn(
                            "absolute top-0.5 w-3 h-3 rounded-full shadow-sm",
                            !isDisabled ? "bg-white" : "bg-text-muted"
                          )}
                          animate={{ left: !isDisabled ? 17 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>

                      <span className="text-sm text-text-secondary flex-1 truncate">
                        {change.label}
                      </span>
                      <span className="text-xs font-mono text-text-muted/60 shrink-0" style={{ marginRight: "4px" }}>
                        {formatHex(change.offset)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
