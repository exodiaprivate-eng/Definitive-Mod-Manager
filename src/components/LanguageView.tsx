import { cn } from "@/lib/utils";
import { Globe, Check, FolderPlus, Type, Upload } from "lucide-react";
import type { LangModEntry, GameFontEntry } from "@/types";

interface LanguageViewProps {
  langMods: LangModEntry[];
  selectedLanguage: string;
  onActivate: (fileName: string | null) => void;
  onImportLang: () => void;
  gameFonts?: GameFontEntry[];
  onReplaceFont?: (fontGamePath: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function LanguageView({
  langMods,
  selectedLanguage,
  onActivate,
  onImportLang,
  gameFonts = [],
  onReplaceFont,
}: LanguageViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-8 pt-7 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Language &amp; Fonts</h1>
            <p className="text-sm text-text-muted mt-2">
              Translation patches and per-language font replacement — Current: <span className="text-text-secondary font-semibold">{selectedLanguage}</span>
            </p>
          </div>
          <button
            onClick={onImportLang}
            style={{ padding: "8px 16px", fontSize: "13px" }}
            className="flex items-center gap-2 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            Import Language Mod
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {/* Language Mods Section */}
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Language Mods
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onActivate(null)}
            className={cn(
              "w-full rounded-sm border p-4 text-left transition-all duration-200",
              !langMods.some((m) => m.active)
                ? "bg-accent/[0.03] border-accent/30"
                : "bg-surface/80 border-border/60 hover:border-border-hover"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-8 h-8 rounded-sm flex items-center justify-center",
                !langMods.some((m) => m.active)
                  ? "bg-accent/10 border border-accent/15"
                  : "bg-white/[0.03] border border-border/40"
              )}>
                <Globe className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text-primary">Default (English)</h3>
                <p className="text-sm text-text-muted">Original game language — no modifications</p>
              </div>
              {!langMods.some((m) => m.active) && (
                <Check className="w-5 h-5 text-accent" />
              )}
            </div>
          </button>

          {langMods.map((mod) => (
            <button
              key={mod.file_name}
              onClick={() => onActivate(mod.file_name)}
              className={cn(
                "w-full rounded-sm border p-4 text-left transition-all duration-200",
                mod.active
                  ? "bg-accent/[0.03] border-accent/30"
                  : "bg-surface/80 border-border/60 hover:border-border-hover"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-sm flex items-center justify-center",
                  mod.active
                    ? "bg-accent/10 border border-accent/15"
                    : "bg-white/[0.03] border border-border/40"
                )}>
                  <Globe className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">{mod.title}</h3>
                  <p className="text-sm text-text-muted truncate">
                    by {mod.author}
                    {mod.description && ` — ${mod.description}`}
                  </p>
                </div>
                {mod.active && (
                  <Check className="w-5 h-5 text-accent shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        {langMods.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-8 mb-8 text-text-muted">
            <Globe className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No language mods installed</p>
            <p className="text-xs mt-1 text-text-muted/60">Import language mod JSON files to the _lang folder</p>
          </div>
        )}

        {/* Font Replacement Section */}
        {gameFonts.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4 flex items-center gap-2">
              <Type className="w-4 h-4" />
              Game Fonts ({gameFonts.length})
            </p>
            <p className="text-sm text-text-muted mb-4">
              Replace per-language game fonts with custom .ttf files. Fonts are written to the overlay and reverted on unmount.
            </p>
            <div className="space-y-3">
              {gameFonts.map((font) => (
                <div
                  key={font.path}
                  className="group rounded-sm border bg-surface/80 border-border/60 hover:border-border-hover relative overflow-hidden transition-all"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-border/30 group-hover:bg-accent/50 transition-all duration-300" />

                  <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                    <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                      <Type className="w-4 h-4 text-text-muted" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-text-primary truncate">
                        {font.language}
                      </h3>
                      <div className="flex items-center gap-5 mt-1.5">
                        <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                          {font.filename}
                        </span>
                        <span className="text-sm text-text-muted">
                          {formatBytes(font.orig_size)}
                        </span>
                        <span className="text-sm text-text-muted">
                          Group {font.group}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onReplaceFont?.(font.path)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Replace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
