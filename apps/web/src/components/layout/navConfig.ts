import type { User } from "@/auth/AuthContext";
import {
  canRead,
  type PermissionResource,
} from "@pedidos/shared";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  Table,
  Target,
  Truck,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
  resource: PermissionResource;
};

const home: NavItem = {
  to: "/",
  label: "Início",
  end: true,
  icon: LayoutDashboard,
  resource: "dashboard",
};

/** Catálogo completo (admin); filtrado por `canRead` efetivo. */
export const DASHBOARD_NAV: NavItem[] = [
  home,
  {
    to: "/tabelas-preco",
    label: "Tabelas de preço",
    icon: Table,
    resource: "price_tables",
  },
  { to: "/produtos", label: "Produtos", icon: Package, resource: "products" },
  {
    to: "/fornecedores",
    label: "Fornecedores",
    icon: Truck,
    resource: "suppliers",
  },
  { to: "/estoque", label: "Estoque", icon: Warehouse, resource: "stock" },
  { to: "/vendedores", label: "Vendedores", icon: Users, resource: "sellers" },
  { to: "/usuarios", label: "Usuários", icon: UserCog, resource: "users" },
  { to: "/equipes", label: "Equipes", icon: UsersRound, resource: "teams" },
  {
    to: "/comissao",
    label: "Comissões e metas",
    icon: Target,
    resource: "commissions",
  },
  {
    to: "/clientes",
    label: "Clientes",
    icon: UserCircle,
    resource: "customers",
  },
  {
    to: "/visitas",
    label: "Visitas em campo",
    icon: MapPin,
    resource: "visits",
  },
  {
    to: "/rastreio",
    label: "Rastreio ao vivo",
    icon: Navigation,
    resource: "tracking",
  },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart, resource: "orders" },
  { to: "/fiscal", label: "Fiscal", icon: Receipt, resource: "fiscal" },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    resource: "reports",
  },
  {
    to: "/insights",
    label: "Insights",
    icon: Lightbulb,
    resource: "reports",
  },
  {
    to: "/permissoes",
    label: "Permissões",
    icon: Shield,
    resource: "permissions",
  },
];

export const TEAM_LEADER_NAV: NavItem[] = [
  home,
  {
    to: "/rastreio",
    label: "Rastreio ao vivo",
    icon: Navigation,
    resource: "tracking",
  },
  {
    to: "/visitas",
    label: "Visitas em campo",
    icon: MapPin,
    resource: "visits",
  },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart, resource: "orders" },
  {
    to: "/insights",
    label: "Insights da equipe",
    icon: BarChart3,
    resource: "reports",
  },
];

/** Prefixo de rota → recurso da matriz (para guards). */
export function resourceForPath(pathname: string): PermissionResource | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  if (pathname.startsWith("/tabelas-preco")) return "price_tables";
  if (pathname.startsWith("/produtos")) return "products";
  if (pathname.startsWith("/fornecedores")) return "suppliers";
  if (pathname.startsWith("/estoque")) return "stock";
  if (pathname.startsWith("/vendedores")) return "sellers";
  if (pathname.startsWith("/usuarios")) return "users";
  if (pathname.startsWith("/equipes")) return "teams";
  if (pathname.startsWith("/comissao")) return "commissions";
  if (pathname.startsWith("/clientes") || pathname.startsWith("/notificacoes"))
    return "customers";
  if (pathname.startsWith("/visitas")) return "visits";
  if (pathname.startsWith("/rastreio")) return "tracking";
  if (pathname.startsWith("/vendas")) return "orders";
  if (pathname.startsWith("/fiscal")) return "fiscal";
  if (pathname.startsWith("/relatorios") || pathname.startsWith("/insights"))
    return "reports";
  if (pathname.startsWith("/permissoes")) return "permissions";
  return null;
}

export function navForRole(
  user: Pick<User, "role" | "isTeamLeader" | "permissions"> | null | undefined,
): NavItem[] {
  if (user?.isTeamLeader && user.role === "SELLER") return TEAM_LEADER_NAV;
  if (!user) return [];

  return DASHBOARD_NAV.filter((item) =>
    canRead(user.role, item.resource, user.permissions),
  );
}
