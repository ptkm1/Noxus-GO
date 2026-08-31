import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BookOpen, CircleHelp, Search, UserCircle } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { navForRole, type NavItem } from "./navConfig";

type SearchHit = {
  to: string;
  label: string;
  keywords?: string;
  icon: NavItem["icon"];
};

const EXTRA_HITS: SearchHit[] = [
  {
    to: "/guia",
    label: "Guia inicial",
    keywords: "tutorial videoaula onboarding ajuda",
    icon: BookOpen,
  },
  {
    to: "/ajuda",
    label: "Ajuda e suporte",
    keywords: "contato email whatsapp suporte",
    icon: CircleHelp,
  },
  {
    to: "/perfil",
    label: "Meu perfil",
    keywords: "conta usuario dados",
    icon: UserCircle,
  },
];

function matchQuery(item: SearchHit, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.to} ${item.keywords ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

type Props = {
  /** Classe extra no botão gatilho. */
  className?: string;
};

export function QuickSearch({ className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const fromNav: SearchHit[] = navForRole(user).map((item) => ({
      to: item.to,
      label: item.label,
      icon: item.icon,
    }));
    const seen = new Set(fromNav.map((i) => i.to));
    const extras = EXTRA_HITS.filter((e) => !seen.has(e.to));
    return [...fromNav, ...extras];
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => matchQuery(item, q));
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  function goTo(to: string) {
    setOpen(false);
    navigate(to);
  }

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[activeIndex];
      if (hit) goTo(hit.to);
    }
  }

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1.5 text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label="Busca rápida"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">Busca rápida</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {isMac ? "⌘" : "Ctrl"}K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 p-4 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Busca rápida</DialogTitle>
            <DialogDescription>
              Encontre e abra funcionalidades do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar funcionalidade…"
              className="pl-9"
              aria-autocomplete="list"
              aria-controls="quick-search-results"
            />
          </div>
          <ul
            id="quick-search-results"
            role="listbox"
            className="max-h-72 overflow-y-auto rounded-md border border-border"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado para “{query.trim()}”.
              </li>
            ) : (
              filtered.map((item, index) => {
                const Icon = item.icon;
                const active = index === activeIndex;
                return (
                  <li key={item.to} role="option" aria-selected={active}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/80",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goTo(item.to)}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.to}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <p className="text-xs text-muted-foreground">
            Use ↑↓ para navegar, Enter para abrir, Esc para fechar.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
