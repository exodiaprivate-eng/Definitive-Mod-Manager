import { useEffect, useRef } from "react";
import { Trash2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
}

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const levelColors: Record<LogEntry["level"], string> = {
  info: "text-text-secondary",
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
};

const levelDots: Record<LogEntry["level"], string> = {
  info: "bg-text-muted/30",
  success: "bg-success shadow-[0_0_4px_rgba(16,185,129,0.5)]",
  warning: "bg-warning shadow-[0_0_4px_rgba(245,158,11,0.5)]",
  error: "bg-danger shadow-[0_0_4px_rgba(239,68,68,0.5)]",
};

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#08080e]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-8 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-accent/60" />
          <span className="text-sm font-semibold text-text-secondary">Log</span>
          <span className="text-[11px] text-text-muted/50 font-mono bg-white/[0.02] px-2 py-0.5 rounded">
            {logs.length}
          </span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-muted/50 hover:text-text-secondary hover:bg-white/[0.03] rounded-sm transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-3 font-mono text-[13px]"
      >
        {logs.length === 0 ? (
          <p className="text-text-muted/40 text-sm py-2">Waiting for events...</p>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5 leading-relaxed">
              <div className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", levelDots[entry.level])} />
              <span className="text-text-muted/40 shrink-0 select-none">
                {entry.timestamp}
              </span>
              <span className={cn(levelColors[entry.level])}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
