import type { Role } from "@pedidos/shared";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  MapPin,
  Navigation,
  Package,
  ShoppingCart,
  Table,
  Target,
  UserCircle,
  Users,
  Warehouse,
} from "lucide-react";

export type NavItem = { to: string; label: string; end?: boolean; icon: LucideIcon };

const home: NavItem = { to: "/", label: "Início", end: true, icon: LayoutDashboard };

export const DASHBOARD_NAV: NavItem[] = [
  home,
  { to: "/tabelas-preco", label: "Tabelas de preço", icon: Table },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/vendedores", label: "Vendedores", icon: Users },
  { to: "/comissao", label: "Comissões e metas", icon: Target },
  { to: "/clientes", label: "Clientes", icon: UserCircle },
  { to: "/visitas", label: "Visitas em campo", icon: MapPin },
  { to: "/rastreio", label: "Rastreio ao vivo", icon: Navigation },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/faturamento", label: "Faturamento", icon: FileText },
  { to: "/estoque", label: "Estoque", icon: Warehouse },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

export const MANAGER_NAV: NavItem[] = [
  home,
  { to: "/rastreio", label: "Rastreio ao vivo", icon: Navigation },
  { to: "/visitas", label: "Visitas em campo", icon: MapPin },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
];

export function navForRole(role: Role | undefined): NavItem[] {
  return role === "MANAGER" ? MANAGER_NAV : DASHBOARD_NAV;
}
