import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/auth/AuthContext";
import { apiFetch } from "@/lib/api";
import { isWebAdmin } from "@/lib/staff";
import { ThemeToggle } from "@/components/ThemeToggle";
import { dashboardBackTarget } from "./dashboardBackTarget";
import { DashboardSidebar } from "./DashboardSidebar";

export function DashboardTopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const backTo = dashboardBackTarget(location.pathname);
  const showAlerts = isWebAdmin(user?.role);

  const { data: unreadPayload } = useQuery({
    queryKey: ["admin", "notifications-unread"],
    queryFn: () => apiFetch<{ count: number }>("/admin/notifications/unread-count"),
    staleTime: 10_000,
    refetchInterval: 15_000,
    enabled: showAlerts,
  });
  const unreadCount = unreadPayload?.count ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:h-16 md:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
            <DashboardSidebar onNavigate={() => setSheetOpen(false)} className="w-full border-0" />
          </SheetContent>
        </Sheet>

        {backTo ? (
          <Button variant="ghost" size="sm" onClick={() => navigate(backTo)}>
            ← Voltar
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {showAlerts ? (
          <Button variant="outline" size="icon" className="relative" asChild>
            <Link to="/notificacoes" aria-label="Alertas">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
