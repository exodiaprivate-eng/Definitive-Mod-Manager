import { cn } from "@/lib/utils";
import {
  Blocks,
  Settings,
  AlertTriangle,
  Info,
  Globe,
  Bookmark,
  Archive,
  FolderOpen,
  Gamepad2,
  Plug,
  Paintbrush,
  Package,
  Camera,
  Hammer,
  Grid3x3,
  Users,
} from "lucide-react";

export type View = "mods" | "conflicts" | "compatibility" | "language" | "asi" | "reshade" | "profiles" | "packs" | "community" | "creator" | "snapshots" | "backups" | "settings" | "about";

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  modCount: number;
  activeCount: number;
  conflictCount: number;
  asiCount?: number;
  onOpenModsFolder: () => void;
  onOpenGameFolder: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  badgeColor?: string;
  disabled?: boolean;
}

function NavItem({ icon, label, active, onClick, badge, badgeColor, disabled }: NavItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3.5 px-5 py-3.5 rounded-sm text-[15px] font-medium transition-all duration-200 relative overflow-hidden",
        disabled
          ? "text-text-muted/40 cursor-not-allowed"
          : active
            ? "bg-gradient-to-r from-accent/20 to-accent/5 text-accent shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25),0_0_20px_rgba(99,102,241,0.08)]"
            : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
      )}
    >
      {active && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm bg-accent shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
      )}
      <span className={cn(active && "drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]")}>
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "text-xs font-bold px-2.5 py-1 rounded-sm min-w-[28px] text-center",
            badgeColor || "bg-white/5 text-text-secondary"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ activeView, onViewChange, modCount, activeCount, conflictCount, asiCount, onOpenModsFolder, onOpenGameFolder }: SidebarProps) {
  return (
    <div className="w-64 h-full sidebar-bg border border-border/30 flex flex-col shrink-0">
      <div className="px-4 pt-8 pb-4 flex-1">
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted/60 px-5 mb-4">
            Manage
          </p>
          <div className="space-y-1">
            <NavItem
              icon={<Blocks className="w-5 h-5" />}
              label="Mods"
              active={activeView === "mods"}
              onClick={() => onViewChange("mods")}
              badge={modCount}
            />
            <NavItem
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Conflicts"
              active={activeView === "conflicts"}
              onClick={() => onViewChange("conflicts")}
              badge={conflictCount}
              badgeColor={conflictCount > 0 ? "bg-danger/20 text-danger" : undefined}
            />
            <NavItem
              icon={<Grid3x3 className="w-5 h-5" />}
              label="Compatibility"
              active={activeView === "compatibility"}
              onClick={() => onViewChange("compatibility")}
            />
            <NavItem
              icon={<Globe className="w-5 h-5" />}
              label="Language"
              active={activeView === "language"}
              onClick={() => onViewChange("language")}
            />

            <NavItem
              icon={<Plug className="w-5 h-5" />}
              label="ASI Mods"
              active={activeView === "asi"}
              onClick={() => onViewChange("asi")}
              badge={asiCount}
            />
            <NavItem
              icon={<Bookmark className="w-5 h-5" />}
              label="Profiles"
              active={activeView === "profiles"}
              onClick={() => onViewChange("profiles")}
            />
            <NavItem
              icon={<Package className="w-5 h-5" />}
              label="Packs"
              active={activeView === "packs"}
              onClick={() => onViewChange("packs")}
            />
            <NavItem
              icon={<Users className="w-5 h-5" />}
              label="Community"
              active={activeView === "community"}
              onClick={() => onViewChange("community")}
            />
            <NavItem
              icon={<Hammer className="w-5 h-5" />}
              label="Create Mod (Coming Soon)"
              active={false}
              onClick={() => {}}
              disabled
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted/60 px-5 mb-4">
            System
          </p>
          <div className="space-y-1">
            <NavItem
              icon={<Paintbrush className="w-5 h-5" />}
              label="ReShade"
              active={activeView === "reshade"}
              onClick={() => onViewChange("reshade")}
            />
            <NavItem
              icon={<Camera className="w-5 h-5" />}
              label="Snapshots"
              active={activeView === "snapshots"}
              onClick={() => onViewChange("snapshots")}
            />
            <NavItem
              icon={<Archive className="w-5 h-5" />}
              label="Backups"
              active={activeView === "backups"}
              onClick={() => onViewChange("backups")}
            />

            <NavItem
              icon={<Settings className="w-5 h-5" />}
              label="Settings"
              active={activeView === "settings"}
              onClick={() => onViewChange("settings")}
            />
            <NavItem
              icon={<Info className="w-5 h-5" />}
              label="About"
              active={activeView === "about"}
              onClick={() => onViewChange("about")}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border/30" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div className="text-sm text-text-muted px-3 text-center">
          <span className="text-accent font-semibold">{activeCount}</span> of{" "}
          <span className="text-text-secondary font-semibold">{modCount}</span> mods enabled
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={onOpenModsFolder}
            style={{ padding: "6px 0", fontSize: "12px" }}
            className="flex-1 flex items-center justify-center gap-2 font-medium text-text-muted hover:text-text-secondary bg-white/[0.02] border border-border/40 rounded-sm hover:bg-white/[0.04] transition-all"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Mods
          </button>
          <button
            onClick={onOpenGameFolder}
            style={{ padding: "6px 0", fontSize: "12px" }}
            className="flex-1 flex items-center justify-center gap-2 font-medium text-text-muted hover:text-text-secondary bg-white/[0.02] border border-border/40 rounded-sm hover:bg-white/[0.04] transition-all"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Game
          </button>
        </div>
      </div>
    </div>
  );
}
