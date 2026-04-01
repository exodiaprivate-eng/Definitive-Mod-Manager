import { cn } from "@/lib/utils";
import { Layers, FolderOpen } from "lucide-react";
import type { PapgtStatus } from "@/types";

interface StatusBarProps {
  gamePath: string;
  modsPath: string;
  gamePathValid: boolean;
  papgtStatus: PapgtStatus | null;
}

export function StatusBar({
  gamePath,
  modsPath,
  gamePathValid,
  papgtStatus,
}: StatusBarProps) {
  return (
    <div className="shrink-0 flex items-center gap-5 px-5 py-2.5 bg-surface/30 border border-border/30 text-xs font-mono select-none overflow-x-auto">
      {/* Game path */}
      <div className="flex items-center gap-2.5 shrink-0" title={gamePath}>
        <div className={cn(
          "w-2.5 h-2.5 rounded-full shrink-0",
          gamePathValid
            ? "bg-success shadow-[0_0_6px_rgba(16,185,129,0.6)]"
            : "bg-danger shadow-[0_0_6px_rgba(239,68,68,0.6)]"
        )} />
        <span className={cn(gamePathValid ? "text-success" : "text-danger")}>
          {gamePath || "No game path"}
        </span>
      </div>

      <div className="w-px h-4 bg-border/30 shrink-0" />

      {/* Mods dir */}
      <div className="flex items-center gap-2.5 text-text-muted/70 shrink-0" title={modsPath}>
        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
        <span>{modsPath || "No mods folder"}</span>
      </div>

      <div className="w-px h-4 bg-border/30 shrink-0" />

      {/* Papgt overlay status */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Layers className="w-3.5 h-3.5 text-text-muted/40 shrink-0" />
        {papgtStatus === null ? (
          <span className="text-text-muted/40">scanning...</span>
        ) : !papgtStatus.exists ? (
          <span className="text-text-muted/40">papgt not found</span>
        ) : papgtStatus.has_overlay ? (
          <span className="text-accent/70">
            overlay active ({papgtStatus.overlay_groups.length} overlays, {papgtStatus.total_groups} total)
          </span>
        ) : (
          <span className="text-text-muted/40">
            no overlay ({papgtStatus.total_groups} groups)
          </span>
        )}
      </div>
    </div>
  );
}
