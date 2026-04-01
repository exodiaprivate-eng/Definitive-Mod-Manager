import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Globe, Check, FolderPlus } from "lucide-react";
import type { LangModEntry } from "@/types";

interface LanguageViewProps {
  langMods: LangModEntry[];
  selectedLanguage: string;
  onActivate: (fileName: string | null) => void;
  onImportLang: () => void;
}

export function LanguageView({
  langMods,
  selectedLanguage,
  onActivate,
  onImportLang,
}: LanguageViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-8 pt-7 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Language Mods</h1>
            <p className="text-sm text-text-muted mt-2">
              Translation and localization patches — Current: <span className="text-text-secondary font-semibold">{selectedLanguage}</span>
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
        {/* Default (no language mod) */}
        <div className="space-y-2">
          <motion.button
            layout
            onClick={() => onActivate(null)}
            className={cn(
              "w-full rounded-[var(--radius-lg)] border p-4 text-left transition-all duration-200",
              !langMods.some((m) => m.active)
                ? "bg-accent-muted border-accent/20 shadow-[0_0_20px_rgba(99,102,241,0.06)]"
                : "bg-surface border-border hover:border-border-hover"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center",
                !langMods.some((m) => m.active)
                  ? "bg-accent/20"
                  : "bg-surface-active"
              )}>
                <Globe className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary">Default (English)</h3>
                <p className="text-xs text-text-muted">Original game language — no modifications</p>
              </div>
              {!langMods.some((m) => m.active) && (
                <Check className="w-5 h-5 text-accent" />
              )}
            </div>
          </motion.button>

          {langMods.map((mod) => (
            <motion.button
              layout
              key={mod.file_name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onActivate(mod.file_name)}
              className={cn(
                "w-full rounded-[var(--radius-lg)] border p-4 text-left transition-all duration-200",
                mod.active
                  ? "bg-accent-muted border-accent/20 shadow-[0_0_20px_rgba(99,102,241,0.06)]"
                  : "bg-surface border-border hover:border-border-hover"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-lg",
                  mod.active ? "bg-accent/20" : "bg-surface-active"
                )}>
                  <Globe className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{mod.title}</h3>
                  <p className="text-xs text-text-muted truncate">
                    by {mod.author}
                    {mod.description && ` — ${mod.description}`}
                  </p>
                </div>
                {mod.active && (
                  <Check className="w-5 h-5 text-accent shrink-0" />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {langMods.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-12 text-text-muted">
            <Globe className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No language mods installed</p>
            <p className="text-xs mt-1">Import language mod JSON files to the _lang folder</p>
          </div>
        )}
      </div>
    </div>
  );
}
