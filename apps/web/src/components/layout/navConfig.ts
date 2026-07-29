import type { User } from "@/auth/AuthContext";
import {
  canRead,
  planHasFeature,
  type PermissionResource,
  type PlanFeature,
} from "@pedidos/shared";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Navigation,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Table,
  Target,
  Truck,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: LucideIcon;
  resource: PermissionResource;
  /** Feature de plano SaaS (além do RBAC). */
  planFeature?: PlanFeature;
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
    planFeature: "price_tables",
  },
  { to: "/produtos", label: "Produtos", icon: Package, resource: "products" },
  {
    to: "/fornecedores",
    label: "Fornecedores",
    icon: Truck,
    resource: "suppliers",
  },
  {
    to: "/condicoes-pagamento",
    label: "Condições de pagamento",
    icon: Wallet,
    resource: "orders",
  },
  { to: "/estoque", label: "Estoque", icon: Warehouse, resource: "stock" },
  { to: "/vendedores", label: "Vendedores", icon: Users, resource: "sellers" },
  {
    to: "/notificar-vendedores",
    label: "Notificar vendedores",
    icon: Bell,
    resource: "broadcast",
    planFeature: "broadcast",
  },
  { to: "/usuarios", label: "Usuários", icon: UserCog, resource: "users" },
  {
    to: "/equipes",
    label: "Equipes",
    icon: UsersRound,
    resource: "teams",
    planFeature: "teams",
  },
  {
    to: "/comissao",
    label: "Comissões e metas",
    icon: Target,
    resource: "commissions",
    planFeature: "commissions",
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
    planFeature: "visits",
  },
  {
    to: "/rastreio",
    label: "Rastreio ao vivo",
    icon: Navigation,
    resource: "tracking",
    planFeature: "tracking",
  },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, resource: "orders" },
  {
    to: "/financeiro",
    label: "Financeiro",
    icon: Receipt,
    resource: "fiscal",
    planFeature: "fiscal_nfe",
  },
  {
    to: "/faturamento",
    label: "Faturamento",
    icon: FileText,
    resource: "fiscal",
    planFeature: "fiscal_nfe",
  },
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
    planFeature: "insights",
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
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
    planFeature: "tracking",
  },
  {
    to: "/visitas",
    label: "Visitas em campo",
    icon: MapPin,
    resource: "visits",
    planFeature: "visits",
  },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, resource: "orders" },
  {
    to: "/insights",
    label: "Insights da equipe",
    icon: BarChart3,
    resource: "reports",
    planFeature: "insights",
  },
];

/** Prefixo de rota → recurso da matriz (para guards). */
export function resourceForPath(pathname: string): PermissionResource | null {
  if (pathname === "/" || pathname === "") return "dashboard";
  if (pathname.startsWith("/tabelas-preco")) return "price_tables";
  if (pathname.startsWith("/produtos")) return "products";
  if (pathname.startsWith("/fornecedores")) return "suppliers";
  if (pathname.startsWith("/condicoes-pagamento")) return "orders";
  if (pathname.startsWith("/estoque")) return "stock";
  if (pathname.startsWith("/vendedores")) return "sellers";
  if (pathname.startsWith("/notificar-vendedores")) return "broadcast";
  if (pathname.startsWith("/usuarios")) return "users";
  if (pathname.startsWith("/equipes")) return "teams";
  if (pathname.startsWith("/comissao")) return "commissions";
  if (pathname.startsWith("/clientes") || pathname.startsWith("/notificacoes"))
    return "customers";
  if (pathname.startsWith("/visitas")) return "visits";
  if (pathname.startsWith("/rastreio")) return "tracking";
  if (pathname.startsWith("/pedidos") || pathname.startsWith("/vendas"))
    return "orders";
  if (
    pathname.startsWith("/financeiro") ||
    pathname.startsWith("/fiscal") ||
    pathname.startsWith("/faturamento")
  )
    return "fiscal";
  if (
    pathname.startsWith("/relatorios") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/indicadores")
  )
    return "reports";
  if (pathname.startsWith("/configuracoes")) return null;
  if (pathname.startsWith("/permissoes")) return "permissions";
  if (pathname.startsWith("/auditoria")) return "audit";
  return null;
}

function userHasPlanFeature(
  user: Pick<User, "subscription"> | null | undefined,
  feature: PlanFeature | undefined,
): boolean {
  if (!feature) return true;
  const planId = user?.subscription?.planId;
  if (user?.subscription?.features?.length) {
    return user.subscription.features.includes(feature);
  }
  return planHasFeature(planId, feature);
}

export function navForRole(
  user:
    | Pick<User, "role" | "isTeamLeader" | "permissions" | "subscription">
    | null
    | undefined,
): NavItem[] {
  if (user?.isTeamLeader && user.role === "SELLER") {
    return TEAM_LEADER_NAV.filter((item) =>
      userHasPlanFeature(user, item.planFeature),
    );
  }
  if (!user) return [];

  return DASHBOARD_NAV.filter((item) => {
    if (!userHasPlanFeature(user, item.planFeature)) return false;
    if (item.to === "/configuracoes") {
      return (
        user.role === "ADMIN" ||
        canRead(user.role, "permissions", user.permissions) ||
        canRead(user.role, "audit", user.permissions)
      );
    }
    return canRead(user.role, item.resource, user.permissions);
  });
}

export function planFeatureForPath(pathname: string): PlanFeature | null {
  const item = [...DASHBOARD_NAV, ...TEAM_LEADER_NAV].find((nav) => {
    if (nav.end) return pathname === nav.to;
    return pathname === nav.to || pathname.startsWith(`${nav.to}/`);
  });
  return item?.planFeature ?? null;
}
