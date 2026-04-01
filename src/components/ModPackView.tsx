import { useState } from "react";
import { Package, Trash2, Upload, Download, Save, Plus, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModPack } from "@/types";

interface ModPackViewProps {
  packs: ModPack[];
  onCreate: (name: string, description: string, author: string) => void;
  onImport: () => void;
  onLoad: (pack: ModPack) => void;
  onExport: (packName: string) => void;
  onDelete: (packName: string) => void;
}

export function ModPackView({ packs, onCreate, onImport, onLoad, onExport, onDelete }: ModPackViewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, description.trim(), author.trim() || "Unknown");
    setName("");
    setDescription("");
    setAuthor("");
    setShowCreate(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && name.trim()) handleCreate();
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Mod Packs</h1>
            <p className="text-sm text-text-muted mt-2">
              Create and share bundled mod configurations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onImport}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.02] border border-border/50 rounded-sm hover:bg-white/[0.04] hover:border-border-hover transition-all"
            >
              <FileUp className="w-4 h-4" />
              Import Pack
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm transition-all",
                showCreate
                  ? "bg-white/[0.05] text-text-secondary border border-border/50"
                  : "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
              )}
            >
              <Plus className="w-4 h-4" />
              Create Pack
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="rounded-sm border border-border/50 bg-surface/80 overflow-hidden" style={{ padding: "20px" }}>
            <div className="space-y-3">
              <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <Package className="w-4 h-4 text-text-muted/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Pack name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Author..."
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm transition-all",
                    name.trim()
                      ? "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
                      : "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
                  )}
                >
                  <Save className="w-4 h-4" />
                  Create from Active Mods
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {packs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No mod packs</p>
            <p className="text-sm mt-1 text-text-muted/60">
              Create a pack from your active mods or import a .dmpack file
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {packs.map((pack) => (
              <div
                key={pack.name}
                className="group rounded-sm border bg-surface/80 border-border/60 hover:border-border-hover relative overflow-hidden transition-all"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/30 group-hover:bg-accent/50 transition-all duration-300" />

                <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                  <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-accent/10 border border-accent/15 shrink-0">
                    <Package className="w-4 h-4 text-accent" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-text-primary truncate">
                      {pack.name}
                    </h3>
                    <div className="flex items-center gap-5 mt-1.5">
                      <span className="text-sm text-text-muted">
                        {formatDate(pack.created)}
                      </span>
                      <span className="text-sm text-text-muted">
                        <span className="text-accent font-semibold">{pack.mods.length}</span> mod{pack.mods.length !== 1 ? "s" : ""}
                      </span>
                      {pack.author && (
                        <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                          {pack.author}
                        </span>
                      )}
                    </div>
                    {pack.description && (
                      <p className="text-xs text-text-muted/70 mt-1.5 truncate">{pack.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLoad(pack)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Load
                    </button>
                    <button
                      onClick={() => onExport(pack.name)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-secondary bg-white/[0.03] border border-border/40 rounded-sm hover:bg-white/[0.06] transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                    <button
                      onClick={() => onDelete(pack.name)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-sm hover:bg-danger/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
