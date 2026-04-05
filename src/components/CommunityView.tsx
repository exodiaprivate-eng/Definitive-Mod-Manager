import { useState } from "react";
import { Users, Upload, Download, Check, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityProfile } from "@/types";

interface CommunityViewProps {
  onExport: (name: string, author: string, description: string) => void;
  onImport: () => void;
  importedProfile: CommunityProfile | null;
  installedFiles: string[];
}

export function CommunityView({ onExport, onImport, importedProfile, installedFiles }: CommunityViewProps) {
  const [showExport, setShowExport] = useState(false);
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");

  function handleExport() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onExport(trimmed, author.trim() || "Unknown", description.trim());
    setName("");
    setAuthor("");
    setDescription("");
    setShowExport(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) handleExport();
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

  const installedSet = new Set(installedFiles.map((f) => f.toLowerCase()));
  const matchedCount = importedProfile
    ? importedProfile.mods.filter((m) => installedSet.has(m.file_name.toLowerCase())).length
    : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-7 pb-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Community Profiles</h1>
            <p className="text-sm text-text-muted mt-2">
              Share your mod list as a lightweight .dmprofile file. Unlike Mod Packs, this is just a checklist of mod names and versions — recipients download the mods themselves.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onImport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.02] border border-border/50 rounded-sm hover:bg-white/[0.04] hover:border-border-hover transition-all"
            >
              <Download className="w-4 h-4" />
              Import Profile
            </button>
            <button
              onClick={() => setShowExport(!showExport)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm transition-all",
                showExport
                  ? "bg-white/[0.05] text-text-secondary border border-border/50"
                  : "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
              )}
            >
              <Plus className="w-4 h-4" />
              Export Current Setup
            </button>
          </div>
        </div>

        {showExport && (
          <div className="rounded-sm border border-border/50 bg-surface/80 overflow-hidden" style={{ padding: "20px" }}>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                  <Users className="w-4 h-4 text-text-muted/50 shrink-0" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Profile name..."
                    className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex items-center w-48 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author..."
                    className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)..."
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowExport(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={!name.trim()}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm transition-all",
                    name.trim()
                      ? "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
                      : "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
                  )}
                >
                  <Upload className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {!importedProfile && !showExport && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted" style={{ gap: "12px" }}>
            <Users className="w-12 h-12 opacity-30" />
            <p className="text-sm">Import a .dmprofile to see required mods, or export your current setup to share</p>
          </div>
        )}

        {importedProfile && (
          <div className="space-y-4">
            <div className="border border-border/40 bg-white/[0.02] rounded-sm" style={{ padding: "20px" }}>
              <div className="flex items-start justify-between">
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h2 className="text-lg font-bold text-text-primary">{importedProfile.name}</h2>
                  <p className="text-xs text-text-muted">
                    by {importedProfile.author} &middot; {formatDate(importedProfile.created)}
                  </p>
                  {importedProfile.description && (
                    <p className="text-sm text-text-secondary mt-2">{importedProfile.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <span className={cn(
                    "text-sm font-semibold",
                    matchedCount === importedProfile.mod_count ? "text-green-400" : "text-amber-400"
                  )}>
                    {matchedCount} of {importedProfile.mod_count} mods installed
                  </span>
                  {matchedCount < importedProfile.mod_count && (
                    <span className="text-xs text-text-muted">
                      {importedProfile.mod_count - matchedCount} missing
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Required Mods ({importedProfile.mod_count})
              </p>
              {importedProfile.mods.map((mod, i) => {
                const installed = installedSet.has(mod.file_name.toLowerCase());
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 border rounded-sm transition-all",
                      installed
                        ? "border-border/30 bg-white/[0.02]"
                        : "border-amber-500/30 bg-amber-500/[0.03]"
                    )}
                    style={{ padding: "12px 14px" }}
                  >
                    {installed ? (
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {mod.title}
                        </span>
                        <span className="text-xs text-text-muted">v{mod.version}</span>
                      </div>
                      <p className="text-xs text-text-muted truncate">{mod.file_name}</p>
                    </div>
                    {!installed && (
                      <span className="shrink-0 text-xs text-amber-400">Missing</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
