import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  Rocket,
  RotateCcw,
  FolderPlus,
  CheckCheck,
  XCircle,
  Filter,
  Play,
  AlertTriangle,
  ClipboardCheck,
  Wrench,
  Image,
  Check,
  Puzzle,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModCard } from "./ModCard";
import type { ModEntry, ModChange, TextureModEntry, BrowserModEntry } from "@/types";

interface PatchDetail {
  game_file: string;
  changes: ModChange[];
}

type FilterMode = "all" | "enabled" | "disabled";

interface ModListProps {
  mods: ModEntry[];
  onToggle: (fileName: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  onApply: () => void;
  onRevert: () => void;
  onImport: () => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onStartGame: () => void;
  onCheck: () => void;
  onRecover: () => void;
  applying: boolean;
  disabledIndicesMap?: Record<string, number[]>;
  onTogglePatch?: (fileName: string, patchIndex: number) => void;
  modDetails?: Record<string, PatchDetail[]>;
  onExpandMod?: (fileName: string) => void;
  versionWarning?: string | null;
  mountedMods?: string[];
  onDeleteMod?: (fileName: string) => void;
  textureMods?: TextureModEntry[];
  activeTextures?: string[];
  onToggleTexture?: (folderName: string) => void;
  browserMods?: BrowserModEntry[];
  activeBrowserMods?: string[];
  onToggleBrowserMod?: (folderName: string) => void;
  activeLangMod?: string | null;
}

function BundleCard({
  folder,
  variants,
  onToggle,
  mountedMods = [],
}: {
  folder: string;
  variants: ModEntry[];
  onToggle: (fileName: string) => void;
  mountedMods?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const activeVariant = variants.find((v) => v.enabled);
  const anyMounted = variants.some((v) => mountedMods.includes(v.file_name));

  // Display name: replace underscores with spaces, title case
  const displayName = folder.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Get shared info from first variant
  const first = variants[0];
  const author = first?.author || "";
  const description = first?.description || "";

  function handleSelect(fileName: string) {
    if (activeVariant && activeVariant.file_name !== fileName) {
      onToggle(activeVariant.file_name);
    }
    onToggle(fileName);
  }

  return (
    <div
      className={cn(
        "card-lift group rounded-sm border relative overflow-hidden mb-3",
        activeVariant
          ? "bg-gradient-to-r from-accent/10 via-surface to-surface border-accent/25 shadow-[0_0_25px_rgba(99,102,241,0.08)]"
          : "bg-surface/80 border-border/60 hover:border-border-hover"
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
        activeVariant
          ? "bg-gradient-to-b from-accent to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          : "bg-border/30 group-hover:bg-text-muted/30"
      )} />

      <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
        {/* Checkbox — toggles active variant or expands if none */}
        <button
          onClick={() => {
            if (activeVariant) {
              onToggle(activeVariant.file_name);
            } else {
              setExpanded(true);
            }
          }}
          className={cn(
            "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
            activeVariant ? "bg-accent border-accent" : "border-border/60 bg-transparent"
          )}
        >
          {activeVariant && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Icon */}
        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
          <FolderOpen className={cn("w-4 h-4", activeVariant ? "text-accent" : "text-text-muted")} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
          <div className="flex items-center gap-3">
            <h3 className={cn(
              "text-base font-semibold truncate transition-colors",
              activeVariant ? "text-text-primary" : "text-text-secondary"
            )}>
              {displayName}
            </h3>
            <span className={cn(
              "text-xs font-mono shrink-0 border rounded-sm",
              activeVariant
                ? "text-accent/80 bg-accent/10 border-accent/15"
                : "text-text-muted bg-white/[0.02] border-border/40"
            )} style={{ padding: "3px 10px" }}>
              {variants.length} variants
            </span>
            {activeVariant && (
              <span className="text-xs text-accent font-medium truncate">
                {activeVariant.file_name.split("/").pop()?.replace(".json", "").replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-5 mt-1.5">
            {author && (
              <span className="text-sm text-text-muted">
                by {author}
              </span>
            )}
            {first?.patch_count && (
              <span className="text-sm text-text-muted">
                <span className={cn("font-semibold", activeVariant ? "text-accent" : "text-text-secondary")}>{first.patch_count}</span> patches
              </span>
            )}
            {description && (
              <span className="text-xs text-text-muted/70 truncate">{description}</span>
            )}
          </div>
        </div>

        {/* Type + mount badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
            json patch
          </span>
          {activeVariant && (
            anyMounted ? (
              <span className="text-[11px] font-mono text-success bg-success/10 px-2.5 py-1 rounded-sm border border-success/25">
                mounted
              </span>
            ) : (
              <span className="text-[11px] font-mono text-warning bg-warning/10 px-2.5 py-1 rounded-sm border border-warning/25">
                not mounted
              </span>
            )
          )}
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2.5 rounded-sm text-text-muted/40 hover:text-text-secondary hover:bg-white/[0.04] transition-all"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded variant list */}
      {expanded && (
        <div className="border-t border-border/40 mx-5 py-3 space-y-2" style={{ marginLeft: "24px" }}>
          {variants.map((v) => {
            const variantLabel = v.file_name.split("/").pop()?.replace(".json", "").replace(/_/g, " ") || v.file_name;
            return (
              <button
                key={v.file_name}
                onClick={() => handleSelect(v.file_name)}
                className={cn(
                  "w-full flex items-center gap-5 px-6 py-5 rounded-sm border text-left transition-all",
                  v.enabled
                    ? "bg-accent/15 border-accent/30 text-text-primary"
                    : "bg-white/[0.02] border-border/30 text-text-secondary hover:bg-white/[0.04] hover:border-border/50"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-sm border-2 flex items-center justify-center shrink-0 transition-all",
                  v.enabled ? "bg-accent border-accent" : "border-text-muted/40 bg-transparent"
                )}>
                  {v.enabled && <Check className="w-4 h-4 text-white" />}
                </div>
                <span className="text-base font-medium flex-1">{variantLabel}</span>
                {v.version && (
                  <span className="text-sm text-text-muted font-mono">{v.version}</span>
                )}
                <span className="text-sm text-text-muted">{v.patch_count} patches</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ModList({
  mods,
  onToggle,
  onReorder,
  onApply,
  onRevert,
  onImport,
  onEnableAll,
  onDisableAll,
  onStartGame,
  onCheck,
  onRecover,
  applying,
  disabledIndicesMap = {},
  onTogglePatch,
  modDetails = {},
  onExpandMod,
  versionWarning,
  mountedMods = [],
  onDeleteMod,
  textureMods = [],
  activeTextures = [],
  onToggleTexture,
  browserMods = [],
  activeBrowserMods = [],
  onToggleBrowserMod,
  activeLangMod,
}: ModListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = mods.filter((mod) => {
    const matchesSearch =
      search === "" ||
      mod.title.toLowerCase().includes(search.toLowerCase()) ||
      mod.author.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "enabled" && mod.enabled) ||
      (filter === "disabled" && !mod.enabled);
    return matchesSearch && matchesFilter;
  });

  const activeCount = mods.filter((m) => m.enabled).length;
  const totalActiveCount = activeCount + activeTextures.length + activeBrowserMods.length + (activeLangMod ? 1 : 0);

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-8 pt-7 pb-5" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Title row + action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-bold text-text-primary">
              Mod Library
            </h1>
          </div>
          <div className="flex items-center" style={{ gap: "10px" }}>
            <button
              onClick={onImport}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
            >
              <FolderPlus className="w-5 h-5" />
              Import
            </button>
            <button
              onClick={onCheck}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-text-secondary bg-white/[0.03] border border-border/60 rounded-sm hover:bg-white/[0.06] hover:border-border-hover transition-all"
            >
              <ClipboardCheck className="w-5 h-5" />
              Check
            </button>
            <button
              onClick={onRecover}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-sm hover:bg-orange-500/20 transition-all"
            >
              <Wrench className="w-5 h-5" />
              Recover
            </button>
            <button
              onClick={onRevert}
              style={{ padding: "8px 16px", fontSize: "13px" }}
              className="flex items-center gap-3 font-medium text-warning bg-warning/10 border border-warning/20 rounded-sm hover:bg-warning/20 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Unmount
            </button>
            <button
              onClick={onApply}
              disabled={applying || totalActiveCount === 0}
              style={{ padding: "8px 20px", fontSize: "13px" }}
              className={cn(
                "flex items-center gap-3 font-semibold rounded-sm transition-all",
                applying || totalActiveCount === 0
                  ? "bg-white/[0.03] text-text-muted cursor-not-allowed border border-border/30"
                  : "bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110"
              )}
            >
              <Rocket className="w-5 h-5" />
              {applying ? "Mounting..." : "Mount Mods"}
            </button>
            <button
              onClick={onStartGame}
              style={{ padding: "8px 20px", fontSize: "13px" }}
              className="pulse-glow flex items-center gap-3 font-semibold rounded-sm bg-gradient-to-r from-emerald-600 to-green-500 text-white hover:brightness-110 transition-all"
            >
              <Play className="w-5 h-5 fill-current" />
              Start Game
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center flex-1 bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
            <Search className="w-4 h-4 text-text-muted/50 shrink-0" />
            <input
              type="text"
              placeholder="Search mods..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm" style={{ padding: "4px", gap: "4px" }}>
            {(["all", "enabled", "disabled"] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                style={{ padding: "6px 14px" }}
                className={cn(
                  "text-sm font-medium rounded-sm transition-all capitalize",
                  filter === mode
                    ? "bg-accent/15 text-accent shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={onEnableAll}
            className="p-3 text-text-muted/40 hover:text-success hover:bg-success/10 rounded-sm transition-all"
            title="Enable all"
          >
            <CheckCheck className="w-5 h-5" />
          </button>
          <button
            onClick={onDisableAll}
            className="p-3 text-text-muted/40 hover:text-danger hover:bg-danger/10 rounded-sm transition-all"
            title="Disable all"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Version warning banner */}
      {versionWarning && (
        <div className="shrink-0 mx-8 mb-3 px-4 py-3 rounded-sm border border-warning/30 bg-warning/5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="text-sm text-warning">{versionWarning}</p>
        </div>
      )}

      {/* Mod list */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Filter className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base">No mods found</p>
            <p className="text-sm mt-1 text-text-muted/60">
              {search ? "Try a different search" : "Import mods to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Bundled mod folders (folder/variant.json) — radio-select cards */}
            {(() => {
              const bundled: Record<string, ModEntry[]> = {};
              const standalone: ModEntry[] = [];
              for (const mod of filtered) {
                if (mod.file_name.includes("/")) {
                  const folder = mod.file_name.split("/")[0];
                  if (!bundled[folder]) bundled[folder] = [];
                  bundled[folder].push(mod);
                } else {
                  standalone.push(mod);
                }
              }
              return Object.entries(bundled).map(([folder, variants]) => (
                <BundleCard
                  key={folder}
                  folder={folder}
                  variants={variants}
                  onToggle={onToggle}
                  mountedMods={mountedMods}
                />
              ));
            })()}

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="mod-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3"
                  >
                    <AnimatePresence>
                      {filtered.filter((m) => !m.file_name.includes("/")).map((mod, index) => (
                        <Draggable
                          key={mod.file_name}
                          draggableId={mod.file_name}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                            >
                              <ModCard
                                mod={mod}
                                index={index}
                                onToggle={onToggle}
                                dragHandleProps={(provided.dragHandleProps ?? undefined) as Record<string, unknown> | undefined}
                                disabledIndices={disabledIndicesMap[mod.file_name] || []}
                                onTogglePatch={onTogglePatch}
                                details={modDetails[mod.file_name] || null}
                                onExpand={onExpandMod}
                                isMounted={mountedMods.includes(mod.file_name)}
                                onDelete={onDeleteMod}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </AnimatePresence>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}

        {/* Non-JSON Mods: merge texture + browser mods that share the same folder */}
        {(() => {
          // Normalize folder name for matching: lowercase, replace underscores with spaces
          const normalize = (name: string) => name.toLowerCase().replace(/_/g, " ").trim();

          // Build lookup maps
          const textureByNorm = new Map<string, typeof textureMods[0]>();
          for (const t of textureMods) {
            textureByNorm.set(normalize(t.folder_name), t);
          }
          const browserByNorm = new Map<string, typeof browserMods[0]>();
          for (const b of browserMods) {
            browserByNorm.set(normalize(b.folder_name), b);
          }

          // Find combined mods (same normalized name in both)
          const combinedKeys = new Set<string>();
          for (const key of textureByNorm.keys()) {
            if (browserByNorm.has(key)) combinedKeys.add(key);
          }

          const combinedMods = Array.from(combinedKeys).map((key) => ({
            texture: textureByNorm.get(key)!,
            browser: browserByNorm.get(key)!,
          }));
          const standaloneTextures = textureMods.filter((t) => !combinedKeys.has(normalize(t.folder_name)));
          const standaloneBrowser = browserMods.filter((b) => !combinedKeys.has(normalize(b.folder_name)));
          const totalNonJson = combinedMods.length + standaloneTextures.length + standaloneBrowser.length;

          if (totalNonJson === 0) return null;

          return (
            <div style={{ marginTop: "24px" }}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4 flex items-center gap-2">
                <Puzzle className="w-4 h-4" />
                Texture, Archive &amp; File Mods ({totalNonJson})
              </p>
              <div className="space-y-3">
                {/* Combined cards */}
                {combinedMods.map(({ texture, browser }) => {
                  const texEnabled = activeTextures.includes(texture.folder_name);
                  const browserEnabled = activeBrowserMods.includes(browser.folder_name);
                  const enabled = texEnabled || browserEnabled;
                  return (
                    <div
                      key={`combined-${texture.folder_name}`}
                      className={cn(
                        "group rounded-sm border relative overflow-hidden transition-all cursor-pointer",
                        enabled
                          ? "bg-accent/[0.03] border-accent/30 hover:border-accent/50"
                          : "bg-surface/80 border-border/60 hover:border-border-hover"
                      )}
                      onClick={() => {
                        // Sync both to the same state: if either is on, turn both off; if both off, turn both on
                        const anyEnabled = texEnabled || browserEnabled;
                        if (anyEnabled) {
                          // Turn off whichever is on
                          if (texEnabled) onToggleTexture?.(texture.folder_name);
                          if (browserEnabled) onToggleBrowserMod?.(browser.folder_name);
                        } else {
                          // Turn both on
                          onToggleTexture?.(texture.folder_name);
                          onToggleBrowserMod?.(browser.folder_name);
                        }
                      }}
                    >
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                        enabled ? "bg-accent/70" : "bg-border/30 group-hover:bg-accent/50"
                      )} />

                      <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                            enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
                          )}
                        >
                          {enabled && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>

                        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                          <Puzzle className={cn("w-4 h-4", enabled ? "text-accent" : "text-text-muted")} />
                        </div>

                        <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
                          <h3 className={cn("text-base font-semibold truncate", enabled ? "text-text-primary" : "text-text-secondary")}>
                            {browser.title}
                          </h3>
                          <div className="flex items-center gap-5 mt-1.5">
                            {browser.author && browser.author !== "Unknown" && (
                              <span className="text-sm text-text-muted">by {browser.author}</span>
                            )}
                            {browser.version && (
                              <span className="text-sm text-text-muted">v{browser.version}</span>
                            )}
                            <span className="text-sm text-text-muted">
                              <span className={cn("font-semibold", enabled ? "text-accent" : "text-text-secondary")}>{texture.dds_count}</span> DDS texture{texture.dds_count !== 1 ? "s" : ""}
                            </span>
                            <span className="text-sm text-text-muted">
                              <span className={cn("font-semibold", enabled ? "text-accent" : "text-text-secondary")}>{browser.file_count}</span> file{browser.file_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {browser.description && (
                            <p className="text-xs text-text-muted/70 mt-1.5 truncate">{browser.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                            texture
                          </span>
                          <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                            {browser.mod_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Standalone texture mods */}
                {standaloneTextures.map((mod) => {
                  const enabled = activeTextures.includes(mod.folder_name);
                  return (
                    <div
                      key={mod.folder_name}
                      className={cn(
                        "group rounded-sm border relative overflow-hidden transition-all cursor-pointer",
                        enabled
                          ? "bg-accent/[0.03] border-accent/30 hover:border-accent/50"
                          : "bg-surface/80 border-border/60 hover:border-border-hover"
                      )}
                      onClick={() => onToggleTexture?.(mod.folder_name)}
                    >
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                        enabled ? "bg-accent/70" : "bg-border/30 group-hover:bg-accent/50"
                      )} />

                      <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
                        <div className={cn(
                          "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                          enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
                        )}>
                          {enabled && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>

                        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                          <Image className={cn("w-4 h-4", enabled ? "text-accent" : "text-text-muted")} />
                        </div>

                        <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
                          <h3 className={cn("text-base font-semibold truncate", enabled ? "text-text-primary" : "text-text-secondary")}>
                            {mod.name}
                          </h3>
                          <p className="text-sm text-text-muted mt-1">
                            <span className={cn("font-semibold", enabled ? "text-accent" : "text-text-secondary")}>{mod.dds_count}</span> DDS texture{mod.dds_count !== 1 ? "s" : ""}
                          </p>
                        </div>

                        <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                          texture
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Standalone browser/archive mods */}
                {standaloneBrowser.map((mod) => {
                  const enabled = activeBrowserMods.includes(mod.folder_name);
                  return (
                    <div
                      key={mod.folder_name}
                      className={cn(
                        "group rounded-sm border relative overflow-hidden transition-all cursor-pointer",
                        enabled
                          ? "bg-accent/[0.03] border-accent/30 hover:border-accent/50"
                          : "bg-surface/80 border-border/60 hover:border-border-hover"
                      )}
                      onClick={() => onToggleBrowserMod?.(mod.folder_name)}
                    >
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                        enabled ? "bg-accent/70" : "bg-border/30 group-hover:bg-accent/50"
                      )} />

                      <div className="flex items-center gap-4 pr-5 py-5" style={{ paddingLeft: "20px" }}>
                        <div className={cn(
                          "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                          enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
                        )}>
                          {enabled && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>

                        <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                          <Puzzle className={cn("w-4 h-4", enabled ? "text-accent" : "text-text-muted")} />
                        </div>

                        <div className="flex-1 min-w-0" style={{ marginLeft: "4px" }}>
                          <h3 className={cn("text-base font-semibold truncate", enabled ? "text-text-primary" : "text-text-secondary")}>
                            {mod.title}
                          </h3>
                          <div className="flex items-center gap-5 mt-1.5">
                            {mod.author && mod.author !== "Unknown" && (
                              <span className="text-sm text-text-muted">by {mod.author}</span>
                            )}
                            {mod.version && (
                              <span className="text-sm text-text-muted">v{mod.version}</span>
                            )}
                            <span className="text-sm text-text-muted">
                              <span className={cn("font-semibold", enabled ? "text-accent" : "text-text-secondary")}>{mod.file_count}</span> file{mod.file_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {mod.description && (
                            <p className="text-xs text-text-muted/70 mt-1.5 truncate">{mod.description}</p>
                          )}
                        </div>

                        <span className="text-[11px] font-mono bg-white/[0.03] text-text-muted px-2.5 py-1 rounded-sm border border-border/30">
                          {mod.mod_type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
