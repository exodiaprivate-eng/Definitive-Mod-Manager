import { AlertTriangle, FileWarning } from "lucide-react";
import type { ConflictInfo } from "@/types";

interface ConflictViewProps {
  conflicts: ConflictInfo[];
}

export function ConflictView({ conflicts }: ConflictViewProps) {
  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <div className="w-16 h-16 rounded-full bg-success-muted flex items-center justify-center mb-4">
          <FileWarning className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">No Conflicts</h2>
        <p className="text-sm text-text-secondary">All active mods are compatible</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-8 pt-7 pb-5">
        <h1 className="text-2xl font-bold text-text-primary">Mod Conflicts</h1>
        <p className="text-sm text-text-muted mt-2">
          <span className="text-danger font-semibold">{conflicts.length}</span> conflict{conflicts.length !== 1 ? "s" : ""} detected between active mods
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-3">
        {conflicts.map((conflict, i) => (
          <div
            key={`${conflict.game_file}-${conflict.offset}-${i}`}
            className="rounded-[var(--radius-lg)] border border-warning/20 bg-warning-muted/30 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">
                    Offset Collision
                  </span>
                  <span className="text-[10px] font-mono bg-surface-active text-text-muted px-2 py-0.5 rounded">
                    0x{conflict.offset.toString(16).toUpperCase().padStart(6, "0")}
                  </span>
                </div>

                <p className="text-xs text-text-muted mb-2 font-mono">
                  {conflict.game_file}
                </p>

                <div className="space-y-1.5">
                  {conflict.mods.map((mod, j) => (
                    <div
                      key={`${mod}-${j}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                      <span className="text-text-secondary font-medium">{mod}</span>
                      <span className="text-text-muted">
                        &mdash; {conflict.labels[j]}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
                  These mods modify the same byte offset. The last mod in load order
                  will take priority.
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
