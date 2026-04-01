import { Archive, Trash2, RotateCcw, HardDrive } from "lucide-react";
import type { BackupInfo } from "@/types";

interface BackupManagerProps {
  backups: BackupInfo[];
  onRestore: (fileName: string) => void;
  onDelete: (fileName: string) => void;
  onRestoreAll: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
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

export function BackupManager({ backups, onRestore, onDelete, onRestoreAll }: BackupManagerProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-7 pb-5 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Backups</h1>
            <p className="text-sm text-text-muted mt-2">
              <span className="text-text-secondary font-semibold">{backups.length}</span> backup file{backups.length !== 1 ? "s" : ""} stored
            </p>
          </div>
          {backups.length > 0 && (
            <button
              onClick={onRestoreAll}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Restore All
            </button>
          )}
        </div>
      </div>

      {/* Backup list */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Archive className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No backups found</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Backups are created automatically when mods are mounted
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.file_name}
                className="group rounded-sm border bg-surface/80 border-border/60 hover:border-border-hover relative overflow-hidden transition-all"
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/30 group-hover:bg-accent/50 transition-all duration-300" />

                <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                    <HardDrive className="w-4 h-4 text-text-muted" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {backup.file_name}
                    </h3>
                    <div className="flex items-center gap-5 mt-1.5">
                      <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                        {backup.game_file}
                      </span>
                      <span className="text-sm text-text-muted">
                        {formatBytes(backup.size)}
                      </span>
                      <span className="text-sm text-text-muted">
                        {formatDate(backup.created)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRestore(backup.file_name)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                    <button
                      onClick={() => onDelete(backup.file_name)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-sm hover:bg-danger/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
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
