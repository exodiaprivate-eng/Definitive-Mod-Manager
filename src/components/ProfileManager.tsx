import { useState } from "react";
import { Bookmark, Trash2, Upload, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModProfile } from "@/types";

interface ProfileManagerProps {
  profiles: ModProfile[];
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
}

export function ProfileManager({ profiles, onSave, onLoad, onDelete }: ProfileManagerProps) {
  const [newName, setNewName] = useState("");

  function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setNewName("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
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
          <h1 className="text-2xl font-bold text-text-primary">Profiles</h1>
          <p className="text-sm text-text-muted mt-2">
            Save and load mod configurations as reusable profiles
          </p>
        </div>

        {/* Save new profile */}
        <div className="flex items-center gap-3">
          <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
            <Bookmark className="w-4 h-4 text-text-muted/50 shrink-0" />
            <input
              type="text"
              placeholder="Profile name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!newName.trim()}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm transition-all",
              newName.trim()
                ? "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
                : "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
            )}
          >
            <Save className="w-4 h-4" />
            Save Profile
          </button>
        </div>
      </div>

      {/* Profile list */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Bookmark className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No profiles yet</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Save your current mod configuration as a profile
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.name}
                className="group rounded-sm border bg-surface/80 border-border/60 hover:border-border-hover relative overflow-hidden transition-all"
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/30 group-hover:bg-accent/50 transition-all duration-300" />

                <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent/10 border border-accent/15 shrink-0">
                    <Bookmark className="w-4 h-4 text-accent" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {profile.name}
                    </h3>
                    <div className="flex items-center gap-5 mt-1.5">
                      <span className="text-sm text-text-muted">
                        {formatDate(profile.created)}
                      </span>
                      <span className="text-sm text-text-muted">
                        <span className="text-accent font-semibold">{profile.activeMods.length}</span> mods
                      </span>
                      {profile.activeLangMod && (
                        <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                          {profile.selectedLanguage}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLoad(profile.name)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Load
                    </button>
                    <button
                      onClick={() => onDelete(profile.name)}
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
