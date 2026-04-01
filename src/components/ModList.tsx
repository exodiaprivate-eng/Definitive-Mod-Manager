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
  Download,
  Image,
  Check,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModCard } from "./ModCard";
import type { ModEntry, ModChange, ModUpdateStatus, TextureModEntry, BrowserModEntry } from "@/types";

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
  updateStatuses?: Record<string, ModUpdateStatus>;
  mountedMods?: string[];
  onDeleteMod?: (fileName: string) => void;
  thumbnails?: Record<string, string>;
  textureMods?: TextureModEntry[];
  activeTextures?: string[];
  onToggleTexture?: (folderName: string) => void;
  browserMods?: BrowserModEntry[];
  activeBrowserMods?: string[];
  onToggleBrowserMod?: (folderName: string) => void;
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
  updateStatuses = {},
  mountedMods = [],
  onDeleteMod,
  thumbnails = {},
  textureMods = [],
  activeTextures = [],
  onToggleTexture,
  browserMods = [],
  activeBrowserMods = [],
  onToggleBrowserMod,
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
  const outdatedMods = Object.values(updateStatuses).filter((s) => s.is_outdated);
  const outdatedCount = outdatedMods.length;

  function handleUpdateAll() {
    for (const status of outdatedMods) {
      if (status.nexus_url) {
        window.open(status.nexus_url, "_blank");
      }
    }
  }

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
            {outdatedCount > 0 && (
              <button
                onClick={handleUpdateAll}
                style={{ padding: "8px 16px", fontSize: "13px" }}
                className="flex items-center gap-3 font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all relative"
              >
                <Download className="w-5 h-5" />
                Update All
                <span className="text-xs font-bold bg-danger text-white rounded-sm" style={{ padding: "1px 7px", minWidth: "20px", textAlign: "center" }}>
                  {outdatedCount}
                </span>
              </button>
            )}
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
              disabled={applying || activeCount === 0}
              style={{ padding: "8px 20px", fontSize: "13px" }}
              className={cn(
                "flex items-center gap-3 font-semibold rounded-sm transition-all",
                applying || activeCount === 0
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="mod-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-3"
                >
                  <AnimatePresence>
                    {filtered.map((mod, index) => (
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
                              updateStatus={updateStatuses[mod.file_name]}
                              isMounted={mountedMods.includes(mod.file_name)}
                              onDelete={onDeleteMod}
                              thumbnailPath={thumbnails[mod.file_name]}
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
        )}

        {/* Texture Mods */}
        {textureMods.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Texture Mods ({textureMods.length})
            </p>
            <div className="space-y-3">
              {textureMods.map((mod) => {
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

                    <div className="flex items-center gap-5 pl-6 pr-5 py-5">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-all",
                          enabled ? "bg-accent border-accent" : "border-border/60 bg-transparent"
                        )}
                      >
                        {enabled && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>

                      <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-white/[0.03] border border-border/40 shrink-0">
                        <Image className={cn("w-4 h-4", enabled ? "text-accent" : "text-text-muted")} />
                      </div>

                      <div className="flex-1 min-w-0">
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
            </div>
          </div>
        )}

        {/* File Replacement Mods */}
        {browserMods.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4 flex items-center gap-2">
              <Puzzle className="w-4 h-4" />
              File Replacement Mods ({browserMods.length})
            </p>
            <div className="space-y-3">
              {browserMods.map((mod) => {
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

                    <div className="flex items-center gap-5 pl-6 pr-5 py-5">
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

                      <div className="flex-1 min-w-0">
                        <h3 className={cn("text-base font-semibold truncate", enabled ? "text-text-primary" : "text-text-secondary")}>
                          {mod.title}
                        </h3>
                        <div className="flex items-center gap-5 mt-1.5">
                          <span className="text-sm text-text-muted">
                            by {mod.author}
                          </span>
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
                        file replace
                      </span>
                    </div>
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
