import { useState } from "react";
import { Search, ExternalLink, ThumbsUp, Download, Loader2 } from "lucide-react";
import type { NexusSearchResult } from "@/types";

interface NexusBrowseViewProps {
  onSearch: (query: string) => Promise<NexusSearchResult[]>;
}

export function NexusBrowseView({ onSearch }: NexusBrowseViewProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NexusSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await onSearch(trimmed);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 pt-7 pb-5 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Browse Nexus</h1>
          <p className="text-sm text-text-muted mt-2">
            Search and browse Crimson Desert mods on Nexus Mods
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search for mods..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-border/50 rounded-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/60 transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm bg-gradient-to-r from-accent to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search Nexus
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {!searched && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted" style={{ gap: "12px" }}>
            <Search className="w-12 h-12 opacity-30" />
            <p className="text-sm">Search for Crimson Desert mods on Nexus</p>
          </div>
        )}

        {searched && searching && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted" style={{ gap: "12px" }}>
            <Loader2 className="w-8 h-8 animate-spin opacity-50" />
            <p className="text-sm">Searching Nexus Mods...</p>
          </div>
        )}

        {searched && !searching && results.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted" style={{ gap: "12px" }}>
            <Search className="w-12 h-12 opacity-30" />
            <p className="text-sm">No results found</p>
          </div>
        )}

        {!searching && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((mod) => (
              <div
                key={mod.mod_id}
                className="flex gap-4 border border-border/30 bg-white/[0.02] rounded-sm hover:bg-white/[0.04] transition-all"
                style={{ padding: "14px 16px" }}
              >
                {mod.image_url && (
                  <img
                    src={mod.image_url}
                    alt={mod.name}
                    className="w-20 h-20 object-cover rounded-sm shrink-0 bg-white/[0.03]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary truncate">
                        {mod.name}
                      </h3>
                      <p className="text-xs text-text-muted">
                        by {mod.author}
                        {mod.category && <span className="text-text-muted/50"> &middot; {mod.category}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => window.open(mod.url, "_blank")}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 border border-accent/20 rounded-sm hover:bg-accent/20 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open on Nexus
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {truncate(mod.summary, 200)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {formatNumber(mod.endorsements)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatNumber(mod.downloads)}
                    </span>
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
