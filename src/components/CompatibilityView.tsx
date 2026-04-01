import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Grid3x3, RefreshCw, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompatEntry, CompatConflict } from "@/types";

interface CompatibilityViewProps {
  modsPath: string;
}

export function CompatibilityView({ modsPath }: CompatibilityViewProps) {
  const [matrix, setMatrix] = useState<CompatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CompatEntry | null>(null);

  async function loadMatrix() {
    if (!modsPath) return;
    setLoading(true);
    try {
      const result = await invoke<CompatEntry[]>("get_compatibility_matrix", { modsPath });
      setMatrix(result);
    } catch (e) {
      console.error("Failed to load compatibility matrix:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatrix();
  }, [modsPath]);

  // Extract unique mod names
  const modNames = useMemo(() => {
    const names = new Set<string>();
    for (const entry of matrix) {
      names.add(entry.mod_a);
      names.add(entry.mod_b);
    }
    return Array.from(names).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [matrix]);

  // Build a lookup map
  const lookupMap = useMemo(() => {
    const map = new Map<string, CompatEntry>();
    for (const entry of matrix) {
      map.set(`${entry.mod_a}|${entry.mod_b}`, entry);
      map.set(`${entry.mod_b}|${entry.mod_a}`, entry);
    }
    return map;
  }, [matrix]);

  const conflictCount = matrix.filter((e) => !e.compatible).length;
  const totalPairs = matrix.length;

  function formatHex(offset: number): string {
    return "0x" + offset.toString(16).toUpperCase();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0" style={{ padding: "28px 32px 20px" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Grid3x3 className="w-6 h-6 text-accent" />
              <h1 className="text-2xl font-bold text-text-primary">Compatibility Matrix</h1>
            </div>
            <p className="text-sm text-text-muted mt-2">
              Visual grid showing which mods conflict with each other
            </p>
          </div>
          <div className="flex items-center" style={{ gap: "12px" }}>
            <span className="text-sm text-text-muted">
              <span className="font-semibold text-danger">{conflictCount}</span> of{" "}
              <span className="font-semibold text-text-secondary">{totalPairs}</span> mod pairs have conflicts
            </span>
            <button
              onClick={loadMatrix}
              disabled={loading}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className={cn(
                "flex items-center gap-2 font-medium border rounded-sm transition-all",
                !loading
                  ? "text-accent bg-accent/10 border-accent/20 hover:bg-accent/20"
                  : "text-text-muted bg-surface-hover border-border cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              {loading ? "Scanning..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: "0 32px 32px" }}>
        {modNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Grid3x3 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No mods found</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Add mods to your mods folder to see compatibility
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Matrix grid */}
            <div className="overflow-auto border border-border/30 bg-surface/20 rounded-sm">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th
                      className="sticky left-0 top-0 z-20 bg-surface border-b border-r border-border/30"
                      style={{ padding: "10px 16px", minWidth: "160px" }}
                    />
                    {modNames.map((name) => (
                      <th
                        key={name}
                        className="sticky top-0 z-10 bg-surface border-b border-border/30 text-xs font-medium text-text-muted"
                        style={{ padding: "10px 8px", minWidth: "48px", maxWidth: "80px", writingMode: "vertical-lr", textOrientation: "mixed" }}
                      >
                        <span className="truncate">{name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modNames.map((rowMod) => (
                    <tr key={rowMod}>
                      <td
                        className="sticky left-0 z-10 bg-surface border-r border-b border-border/30 text-xs font-medium text-text-secondary truncate"
                        style={{ padding: "8px 16px", maxWidth: "200px" }}
                        title={rowMod}
                      >
                        {rowMod}
                      </td>
                      {modNames.map((colMod) => {
                        if (rowMod === colMod) {
                          return (
                            <td
                              key={colMod}
                              className="border-b border-border/30 bg-white/[0.02]"
                              style={{ padding: "4px", minWidth: "48px" }}
                            >
                              <div className="w-full h-8 flex items-center justify-center text-text-muted/30">
                                --
                              </div>
                            </td>
                          );
                        }

                        const entry = lookupMap.get(`${rowMod}|${colMod}`);
                        const isCompatible = entry ? entry.compatible : true;
                        const conflictN = entry ? entry.conflicts.length : 0;

                        return (
                          <td
                            key={colMod}
                            className="border-b border-border/30"
                            style={{ padding: "4px", minWidth: "48px" }}
                          >
                            <button
                              onClick={() => entry && !entry.compatible && setSelectedCell(entry)}
                              className={cn(
                                "w-full h-8 flex items-center justify-center rounded-sm text-xs font-bold transition-all",
                                isCompatible
                                  ? "bg-success/10 text-success/70 border border-success/15"
                                  : "bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25 cursor-pointer"
                              )}
                              title={isCompatible ? "Compatible" : `${conflictN} conflict(s)`}
                              disabled={isCompatible}
                            >
                              {isCompatible ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                conflictN
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Conflict detail panel */}
            {selectedCell && (
              <div className="border border-border bg-surface rounded-sm" style={{ padding: "20px" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "16px" }}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-danger" />
                    <h3 className="text-base font-semibold text-text-primary">
                      Conflict Details
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="p-2 text-text-muted hover:text-text-secondary hover:bg-white/[0.04] rounded-sm transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2" style={{ marginBottom: "16px" }}>
                  <span className="text-sm font-semibold text-accent">{selectedCell.mod_a}</span>
                  <span className="text-sm text-text-muted">vs</span>
                  <span className="text-sm font-semibold text-accent">{selectedCell.mod_b}</span>
                  <span className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-sm" style={{ padding: "2px 8px", marginLeft: "8px" }}>
                    {selectedCell.conflicts.length} conflict(s)
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedCell.conflicts.map((c: CompatConflict, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 bg-white/[0.02] border border-border/30 rounded-sm"
                      style={{ padding: "10px 16px" }}
                    >
                      <span className="text-xs font-mono text-text-muted shrink-0" style={{ minWidth: "100px" }}>
                        {formatHex(c.offset)}
                      </span>
                      <span className="text-xs font-mono text-text-muted/60 shrink-0 truncate" style={{ maxWidth: "200px" }}>
                        {c.game_file}
                      </span>
                      <span className="flex-1 text-sm text-text-secondary truncate">
                        {c.label_a}
                      </span>
                      <span className="text-text-muted/40">vs</span>
                      <span className="flex-1 text-sm text-text-secondary truncate">
                        {c.label_b}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
