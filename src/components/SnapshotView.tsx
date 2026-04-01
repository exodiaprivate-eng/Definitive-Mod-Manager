import { useState } from "react";
import { Camera, Trash2, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Snapshot } from "@/types";

interface SnapshotViewProps {
  snapshots: Snapshot[];
  onCreate: (name: string, description: string) => void;
  onRestore: (name: string) => void;
  onDelete: (name: string) => void;
}

export function SnapshotView({ snapshots, onCreate, onRestore, onDelete }: SnapshotViewProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, description.trim());
    setName("");
    setDescription("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) handleCreate();
  }

  function handleRestore(snapshotName: string) {
    if (confirmRestore === snapshotName) {
      onRestore(snapshotName);
      setConfirmRestore(null);
    } else {
      setConfirmRestore(snapshotName);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-7 pb-5 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Snapshots</h1>
          <p className="text-sm text-text-muted mt-2">
            Save and restore complete game mod state
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
            <Camera className="w-4 h-4 text-text-muted/50 shrink-0" />
            <input
              type="text"
              placeholder="Snapshot name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
            <input
              type="text"
              placeholder="Description (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm transition-all whitespace-nowrap",
              name.trim()
                ? "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
                : "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
            )}
          >
            <Save className="w-4 h-4" />
            Create Snapshot
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Camera className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No snapshots</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Create a snapshot to save your current mod state
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.name}
                className="group rounded-sm border bg-surface/80 border-border/60 hover:border-border-hover relative overflow-hidden transition-all"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/30 group-hover:bg-accent/50 transition-all duration-300" />

                <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent/10 border border-accent/15 shrink-0">
                    <Camera className="w-4 h-4 text-accent" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {snapshot.name}
                    </h3>
                    <div className="flex items-center gap-5 mt-1.5">
                      <span className="text-sm text-text-muted">
                        {formatDate(snapshot.created)}
                      </span>
                      <span className="text-sm text-text-muted">
                        <span className="text-accent font-semibold">{snapshot.mod_count}</span> mod{snapshot.mod_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {snapshot.description && (
                      <p className="text-xs text-text-muted/70 mt-1.5 truncate">{snapshot.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {confirmRestore === snapshot.name ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-warning/10 border border-warning/20">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                          <span className="text-xs text-warning font-medium">This will replace current state</span>
                        </div>
                        <button
                          onClick={() => handleRestore(snapshot.name)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-warning bg-warning/10 border border-warning/20 rounded-sm hover:bg-warning/20 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmRestore(null)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.03] border border-border/40 rounded-sm hover:bg-white/[0.06] transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(snapshot.name)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => onDelete(snapshot.name)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-sm hover:bg-danger/20 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
