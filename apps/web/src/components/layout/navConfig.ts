import type { User } from "@/auth/AuthContext";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Navigation,
  Package,
  Shield,
  ShoppingCart,
  Table,
  Target,
  Truck,
  UserCircle,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
};

const home: NavItem = {
  to: "/",
  label: "Início",
  end: true,
  icon: LayoutDashboard,
};

export const DASHBOARD_NAV: NavItem[] = [
  home,
  { to: "/tabelas-preco", label: "Tabelas de preço", icon: Table },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Warehouse },
  { to: "/vendedores", label: "Vendedores", icon: Users },
  { to: "/comissao", label: "Comissões e metas", icon: Target },
  { to: "/clientes", label: "Clientes", icon: UserCircle },
  { to: "/visitas", label: "Visitas em campo", icon: MapPin },
  { to: "/rastreio", label: "Rastreio ao vivo", icon: Navigation },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/permissoes", label: "Permissões", icon: Shield },
];

export const MANAGER_NAV: NavItem[] = [
  home,
  { to: "/rastreio", label: "Rastreio ao vivo", icon: Navigation },
  { to: "/visitas", label: "Visitas em campo", icon: MapPin },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
];

export const TEAM_LEADER_NAV: NavItem[] = [
  home,
  { to: "/rastreio", label: "Rastreio ao vivo", icon: Navigation },
  { to: "/visitas", label: "Visitas em campo", icon: MapPin },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/insights", label: "Insights da equipe", icon: BarChart3 },
];

function adminNav(): NavItem[] {
  const items = [...DASHBOARD_NAV];
  const produtosIdx = items.findIndex((i) => i.to === "/produtos");
  items.splice(produtosIdx + 1, 0, {
    to: "/fornecedores",
    label: "Fornecedores",
    icon: Truck,
  });
  const vendedoresIdx = items.findIndex((i) => i.to === "/vendedores");
  items.splice(vendedoresIdx + 1, 0, {
    to: "/equipes",
    label: "Equipes",
    icon: UsersRound,
  });
  return items;
}

export function navForRole(
  user: Pick<User, "role" | "isTeamLeader"> | null | undefined,
): NavItem[] {
  if (user?.role === "MANAGER") return MANAGER_NAV;
  if (user?.isTeamLeader) return TEAM_LEADER_NAV;
  return adminNav();
}
