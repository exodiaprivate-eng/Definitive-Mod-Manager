import { useState } from "react";
import { Hammer, Plus, Trash2, Save, FlaskConical, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewModData, NewPatch, NewChange } from "@/types";

interface ModCreatorViewProps {
  onCreate: (modData: NewModData) => void;
}

interface PatchRow {
  id: number;
  game_file: string;
  changes: ChangeRow[];
}

interface ChangeRow {
  id: number;
  offset: string;
  label: string;
  original: string;
  patched: string;
}

let nextPatchId = 1;
let nextChangeId = 1;

function emptyChange(): ChangeRow {
  return { id: nextChangeId++, offset: "", label: "", original: "", patched: "" };
}

function emptyPatch(): PatchRow {
  return { id: nextPatchId++, game_file: "gamedata/storeinfo.pabgb", changes: [emptyChange()] };
}

function isValidHex(s: string): boolean {
  if (!s || s.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(s);
}

function isValidOffset(s: string): boolean {
  if (!s) return false;
  const cleaned = s.startsWith("0x") ? s.slice(2) : s;
  return /^[0-9a-fA-F]+$/.test(cleaned) && cleaned.length > 0;
}

export function ModCreatorView({ onCreate }: ModCreatorViewProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [patches, setPatches] = useState<PatchRow[]>([emptyPatch()]);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  function addPatch() {
    setPatches([...patches, emptyPatch()]);
  }

  function removePatch(patchId: number) {
    if (patches.length <= 1) return;
    setPatches(patches.filter((p) => p.id !== patchId));
  }

  function updatePatchFile(patchId: number, gameFile: string) {
    setPatches(patches.map((p) => (p.id === patchId ? { ...p, game_file: gameFile } : p)));
  }

  function addChange(patchId: number) {
    setPatches(
      patches.map((p) =>
        p.id === patchId ? { ...p, changes: [...p.changes, emptyChange()] } : p
      )
    );
  }

  function removeChange(patchId: number, changeId: number) {
    setPatches(
      patches.map((p) => {
        if (p.id !== patchId) return p;
        if (p.changes.length <= 1) return p;
        return { ...p, changes: p.changes.filter((c) => c.id !== changeId) };
      })
    );
  }

  function updateChange(patchId: number, changeId: number, field: keyof ChangeRow, value: string) {
    setPatches(
      patches.map((p) => {
        if (p.id !== patchId) return p;
        return {
          ...p,
          changes: p.changes.map((c) => (c.id === changeId ? { ...c, [field]: value } : c)),
        };
      })
    );
  }

  function validate(): { valid: boolean; message: string } {
    if (!name.trim()) return { valid: false, message: "Mod name is required" };
    if (!version.trim()) return { valid: false, message: "Version is required" };

    for (const patch of patches) {
      if (!patch.game_file.trim()) return { valid: false, message: "Game file path is required" };
      for (const change of patch.changes) {
        if (!change.label.trim()) return { valid: false, message: `Label is required for all changes` };
        if (!isValidOffset(change.offset)) return { valid: false, message: `Invalid offset "${change.offset}" in "${change.label}"` };
        if (!isValidHex(change.original)) return { valid: false, message: `Invalid original hex "${change.original}" in "${change.label}"` };
        if (!isValidHex(change.patched)) return { valid: false, message: `Invalid patched hex "${change.patched}" in "${change.label}"` };

        const origLen = change.original.length / 2;
        const patchLen = change.patched.length / 2;
        if (origLen !== patchLen) {
          return { valid: false, message: `Byte length mismatch in "${change.label}": original ${origLen} bytes vs patched ${patchLen} bytes` };
        }
      }
    }
    return { valid: true, message: "All values are valid" };
  }

  function handleTest() {
    setTestResult(validate());
  }

  function handleCreate() {
    const result = validate();
    if (!result.valid) {
      setTestResult(result);
      return;
    }

    const modData: NewModData = {
      name: name.trim(),
      version: version.trim(),
      author: author.trim() || "Unknown",
      description: description.trim(),
      patches: patches.map((p): NewPatch => ({
        game_file: p.game_file,
        changes: p.changes.map((c): NewChange => {
          const offsetStr = c.offset.startsWith("0x") ? c.offset.slice(2) : c.offset;
          return {
            offset: parseInt(offsetStr, 16),
            label: c.label,
            original: c.original.toLowerCase(),
            patched: c.patched.toLowerCase(),
          };
        }),
      })),
    };

    onCreate(modData);
    setTestResult(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-7 pb-5">
        <h1 className="text-2xl font-bold text-text-primary">Create Mod</h1>
        <p className="text-sm text-text-muted mt-2">
          Build a JSON byte-patch mod by specifying offsets and values
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        <div className="space-y-5">
          {/* Mod Info */}
          <div className="rounded-sm border border-border/50 bg-surface/80 overflow-hidden" style={{ padding: "20px" }}>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60 mb-4">Mod Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <Hammer className="w-4 h-4 text-text-muted/50 shrink-0" />
                <input
                  type="text"
                  placeholder="Mod name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
              <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Version (e.g. 1.0)..."
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
              <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Author..."
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
              <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "40px", paddingLeft: "14px", gap: "10px" }}>
                <input
                  type="text"
                  placeholder="Description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Patches */}
          {patches.map((patch, patchIdx) => (
            <div key={patch.id} className="rounded-sm border border-border/50 bg-surface/80 overflow-hidden" style={{ padding: "20px" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted/60">
                  Patch {patchIdx + 1}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addChange(patch.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-white/[0.02] border border-border/40 rounded-sm hover:bg-white/[0.04] transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Add Change
                  </button>
                  {patches.length > 1 && (
                    <button
                      onClick={() => removePatch(patch.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-sm hover:bg-danger/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center bg-white/[0.02] border border-border/50 rounded-sm focus-within:border-accent/40 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all" style={{ height: "36px", paddingLeft: "14px", gap: "10px" }}>
                  <span className="text-xs text-text-muted/50 shrink-0 font-mono">File:</span>
                  <input
                    type="text"
                    placeholder="gamedata/storeinfo.pabgb"
                    value={patch.game_file}
                    onChange={(e) => updatePatchFile(patch.id, e.target.value)}
                    className="flex-1 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_2fr_2fr_2fr_auto] gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted/40 px-1">Offset</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted/40 px-1">Label</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted/40 px-1">Original (hex)</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted/40 px-1">Patched (hex)</span>
                  <span className="w-8" />
                </div>

                {patch.changes.map((change) => (
                  <div key={change.id} className="grid grid-cols-[1fr_2fr_2fr_2fr_auto] gap-2">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={change.offset}
                      onChange={(e) => updateChange(patch.id, change.id, "offset", e.target.value)}
                      className={cn(
                        "h-8 bg-white/[0.02] border rounded-sm text-xs font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition-all",
                        change.offset && !isValidOffset(change.offset) ? "border-danger/40" : "border-border/50"
                      )}
                      style={{ paddingLeft: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="Change label..."
                      value={change.label}
                      onChange={(e) => updateChange(patch.id, change.id, "label", e.target.value)}
                      className="h-8 bg-white/[0.02] border border-border/50 rounded-sm text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition-all"
                      style={{ paddingLeft: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="e.g. FF00AA"
                      value={change.original}
                      onChange={(e) => updateChange(patch.id, change.id, "original", e.target.value)}
                      className={cn(
                        "h-8 bg-white/[0.02] border rounded-sm text-xs font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition-all",
                        change.original && !isValidHex(change.original) ? "border-danger/40" : "border-border/50"
                      )}
                      style={{ paddingLeft: "8px" }}
                    />
                    <input
                      type="text"
                      placeholder="e.g. FF00BB"
                      value={change.patched}
                      onChange={(e) => updateChange(patch.id, change.id, "patched", e.target.value)}
                      className={cn(
                        "h-8 bg-white/[0.02] border rounded-sm text-xs font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition-all",
                        change.patched && !isValidHex(change.patched) ? "border-danger/40" : "border-border/50"
                      )}
                      style={{ paddingLeft: "8px" }}
                    />
                    <button
                      onClick={() => removeChange(patch.id, change.id)}
                      disabled={patch.changes.length <= 1}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-sm transition-all",
                        patch.changes.length > 1
                          ? "text-danger/60 hover:text-danger hover:bg-danger/10"
                          : "text-text-muted/20 cursor-not-allowed"
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Add Patch + Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={addPatch}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.02] border border-border/50 rounded-sm hover:bg-white/[0.04] hover:border-border-hover transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Patch
            </button>

            <div className="flex items-center gap-2">
              {testResult && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium",
                  testResult.valid
                    ? "bg-success/10 border border-success/20 text-success"
                    : "bg-danger/10 border border-danger/20 text-danger"
                )}>
                  {testResult.valid ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {testResult.message}
                </div>
              )}
              <button
                onClick={handleTest}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/[0.02] border border-border/50 rounded-sm hover:bg-white/[0.04] hover:border-border-hover transition-all"
              >
                <FlaskConical className="w-4 h-4" />
                Test
              </button>
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
                Create Mod
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
