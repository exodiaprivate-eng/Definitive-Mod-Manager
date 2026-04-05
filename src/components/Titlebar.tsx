import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export function Titlebar() {
  const handleMinimize = () => getCurrentWindow().minimize();
  const handleMaximize = () => getCurrentWindow().toggleMaximize();
  const handleClose = () => getCurrentWindow().close();

  return (
    <>
      <div
        data-tauri-drag-region
        className="flex items-center justify-between h-12 px-5 bg-surface/80 border-b border-border/50 select-none shrink-0"
      >
        <div className="flex items-center gap-3" style={{ marginLeft: "8px" }} data-tauri-drag-region>
          <span
            className="text-base font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-accent via-purple-400 to-pink-400"
            data-tauri-drag-region
          >
            Definitive Mod Manager
          </span>
          <span className="text-xs text-text-secondary font-mono" data-tauri-drag-region>
            v1.1.0
          </span>
        </div>

        <div className="flex items-center">
          <button
            onClick={handleMinimize}
            className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-150"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all duration-150"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={handleClose}
            className="w-12 h-12 flex items-center justify-center text-text-muted hover:text-white hover:bg-danger/80 transition-all duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="accent-line shrink-0" />
    </>
  );
}
