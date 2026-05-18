import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import { apiFetch } from "../../lib/api";
import { AppLogo } from "./AppLogo";
import { dashboardBackTarget } from "./dashboardBackTarget";
import { DASHBOARD_NAV } from "./navConfig";

function navClassName(isActive: boolean) {
  return `rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
    isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50"
  }`;
}

function AlertsBellNavLink({ unreadCount }: { unreadCount: number }) {
  const label =
    unreadCount > 0 ? `Alertas (${unreadCount > 99 ? "99+" : unreadCount} não lidos)` : "Alertas";
  return (
    <NavLink
      to="/notificacoes"
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors sm:size-11 ${
          isActive
            ? "border-brand-300 bg-brand-50 text-brand-800"
            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`
      }
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
        />
      </svg>
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </NavLink>
  );
}

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const backTo = dashboardBackTarget(location.pathname);

  const { data: unreadPayload } = useQuery({
    queryKey: ["admin", "notifications-unread"],
    queryFn: () => apiFetch<{ count: number }>("/admin/notifications/unread-count"),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const unreadCount = unreadPayload?.count ?? 0;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4 md:h-16 md:px-6">
        <div className="flex min-w-0 shrink items-center gap-1 sm:gap-2">
          {backTo ? (
            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:px-3"
              aria-label="Voltar"
            >
              <span aria-hidden className="text-base leading-none">
                ←
              </span>
              <span className="hidden sm:inline">Voltar</span>
            </button>
          ) : null}
          <AppLogo />
        </div>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
          {DASHBOARD_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navClassName(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <AlertsBellNavLink unreadCount={unreadCount} />
          <p className="hidden max-w-[180px] truncate text-right text-xs text-slate-500 lg:block lg:text-sm xl:max-w-[260px]">
            {user?.email}
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 lg:inline-flex"
          >
            Sair
          </button>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <span className="text-xl leading-none" aria-hidden>
                ×
              </span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className="block h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="block h-0.5 w-5 rounded-full bg-slate-700" />
                <span className="block h-0.5 w-5 rounded-full bg-slate-700" />
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-nav-panel"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-slate-200 bg-white shadow-xl"
            aria-label="Menu principal"
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
              <span className="text-sm font-semibold text-slate-800">Menu</span>
              <button
                type="button"
                className="rounded p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              <NavLink
                to="/notificacoes"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `${navClassName(isActive)} relative flex items-center justify-between gap-2 px-4 py-3 text-base`
                }
              >
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                    />
                  </svg>
                  Alertas
                </span>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-center text-xs font-semibold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </NavLink>
              {DASHBOARD_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `${navClassName(isActive)} block px-4 py-3 text-base`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="border-t border-slate-100 p-4">
              <p className="mb-3 truncate text-xs text-slate-500">{user?.email}</p>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sair
              </button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
