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
      <div className="shrink-0 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">Language Mods</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Translation and localization patches &middot; Current: {selectedLanguage}
            </p>
          </div>
          <button
            onClick={onImportLang}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface border border-border rounded-[var(--radius-md)] hover:bg-surface-hover hover:border-border-hover transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Import Language Mod
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
