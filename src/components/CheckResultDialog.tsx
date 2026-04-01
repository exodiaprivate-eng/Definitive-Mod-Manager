import { motion } from "framer-motion";
import { Check, X, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DetailedCheckResult } from "@/types";

interface CheckResultDialogProps {
  result: DetailedCheckResult;
  onClose: () => void;
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15 last:border-b-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {value ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <X className="w-4 h-4 text-danger" />
        )}
        <span className={cn("text-sm font-medium", value ? "text-success" : "text-danger")}>
          {value ? "Yes" : "No"}
        </span>
      </div>
    </div>
  );
}

function TextRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15 last:border-b-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn("text-sm text-text-primary", mono && "font-mono text-xs bg-white/[0.04] px-2 py-0.5 rounded-sm")}>
        {value}
      </span>
    </div>
  );
}

export function CheckResultDialog({ result, onClose }: CheckResultDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg mx-4 bg-background border border-border/50 rounded-sm shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-accent drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Detailed Check
              </h2>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                {result.timestamp}
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-4">
          {/* Status rows */}
          <div className="border border-border/30 rounded-sm overflow-hidden bg-white/[0.01]">
            <BoolRow label="Game Directory" value={result.game_dir_ok} />
            <BoolRow label="Interrupted Apply" value={result.interrupted_apply} />
            <BoolRow label="Version Mismatch" value={result.version_mismatch} />
            <BoolRow label="Stale Backup" value={result.stale_backup} />
          </div>

          {/* Version info */}
          <div className="border border-border/30 rounded-sm overflow-hidden bg-white/[0.01]">
            <TextRow label="Current Version" value={result.current_version} mono />
            <TextRow label="Saved Version" value={result.saved_version} mono />
          </div>

          {/* Stats */}
          <div className="border border-border/30 rounded-sm overflow-hidden bg-white/[0.01]">
            <TextRow label="Total Patches" value={String(result.total_patches)} />
            <TextRow label="Target Files" value={String(result.target_files.length)} />
            <TextRow label="Conflicts" value={String(result.conflicts.length)} />
          </div>

          {/* Conflicts list */}
          {result.conflicts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-warning uppercase tracking-wider">Conflicts</p>
              <div className="border border-warning/20 rounded-sm bg-warning/5 p-3 space-y-1.5">
                {result.conflicts.map((c, i) => (
                  <div key={i} className="text-xs text-text-secondary">
                    <span className="font-mono text-warning">{c.game_file}</span>
                    <span className="text-text-muted"> @ offset </span>
                    <span className="font-mono text-text-primary">{c.offset}</span>
                    <span className="text-text-muted"> -- </span>
                    <span className="text-text-secondary">{c.mods.join(" vs ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mod file issues */}
          {result.mod_file_issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-danger uppercase tracking-wider">Mod File Issues</p>
              <div className="border border-danger/20 rounded-sm bg-danger/5 p-3 space-y-1">
                {result.mod_file_issues.map((issue, i) => (
                  <p key={i} className="text-xs text-danger">{issue}</p>
                ))}
              </div>
            </div>
          )}

          {/* Target files */}
          {result.target_files.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Files</p>
              <div className="border border-border/30 rounded-sm bg-white/[0.01] p-3 space-y-1">
                {result.target_files.map((f, i) => (
                  <p key={i} className="text-xs font-mono text-text-secondary">{f}</p>
                ))}
              </div>
            </div>
          )}

          {/* Can Apply - prominent */}
          <div
            className={cn(
              "flex items-center justify-between px-5 py-4 border rounded-sm",
              result.can_apply
                ? "bg-success/5 border-success/20"
                : "bg-danger/5 border-danger/20"
            )}
          >
            <span className="text-sm font-semibold text-text-primary">Can Apply</span>
            <div className="flex items-center gap-2">
              {result.can_apply ? (
                <Check className="w-5 h-5 text-success drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              ) : (
                <X className="w-5 h-5 text-danger drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              )}
              <span className={cn("text-sm font-bold", result.can_apply ? "text-success" : "text-danger")}>
                {result.can_apply ? "Ready" : "Not Ready"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
