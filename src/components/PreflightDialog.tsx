import { motion } from "framer-motion";
import { Check, X, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreflightResult } from "@/types";

interface PreflightDialogProps {
  result: PreflightResult | null;
  onClose: () => void;
  onProceed: () => void;
  checking: boolean;
}

export function PreflightDialog({ result, onClose, onProceed, checking }: PreflightDialogProps) {
  const allPassed = result?.passed ?? false;

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
            {checking ? (
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            ) : allPassed ? (
              <ShieldCheck className="w-6 h-6 text-success drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-danger drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            )}
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Pre-flight Check
              </h2>
              <p className="text-sm text-text-muted mt-0.5">
                {checking
                  ? "Running checks..."
                  : allPassed
                    ? "All checks passed"
                    : "Some checks failed"}
              </p>
            </div>
          </div>
        </div>

        {/* Check list */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {checking && !result ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-accent" />
              <p className="text-sm">Validating configuration...</p>
            </div>
          ) : result ? (
            <div className="space-y-2">
              {result.checks.map((check, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-sm border transition-all",
                    check.passed
                      ? "bg-success/5 border-success/15"
                      : "bg-danger/5 border-danger/15"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {check.passed ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <X className="w-4 h-4 text-danger" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      check.passed ? "text-success" : "text-danger"
                    )}>
                      {check.name}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {check.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            disabled={!allPassed || checking}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm transition-all",
              allPassed && !checking
                ? "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
                : "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
            )}
          >
            Proceed with Mount
          </button>
        </div>
      </motion.div>
    </div>
  );
}
