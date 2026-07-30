import { useAuth } from "@/auth/AuthContext";
import { CommerceProWordmark } from "@/components/brand/CommerceProBrand";
import { Button } from "@/components/ui/button";
import { isWebTeamLeader } from "@/lib/staff";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navForRole } from "./navConfig";

type Props = {
  onNavigate?: () => void;
  className?: string;
};

export function DashboardSidebar({ onNavigate, className }: Props) {
  const { user, logout } = useAuth();
  const navItems = navForRole(user);

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        <CommerceProWordmark iconSize={32} />
      </div>

      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Principal"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-xs text-sidebar-foreground/60">
          {user?.email}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-sidebar-foreground">
          {user?.role === "MANAGER"
            ? "Gestor"
            : isWebTeamLeader(user)
              ? "Líder de equipe"
              : "Administrador"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
