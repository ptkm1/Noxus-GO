import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/produtos", label: "Produtos", end: true },
  { to: "/produtos/promocoes", label: "Promoções", end: false },
  { to: "/produtos/destaques", label: "Destaques", end: false },
] as const;

export function ProductsHubNav() {
  return (
    <nav
      aria-label="Seções de produtos"
      className="flex flex-wrap gap-1 rounded-lg bg-muted p-[3px]"
    >
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
