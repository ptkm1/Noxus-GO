import type { Role } from "@pedidos/shared";

export type NavItem = { to: string; label: string; end?: boolean };

export const DASHBOARD_NAV: NavItem[] = [
  { to: "/", label: "Início", end: true },
  { to: "/tabelas-preco", label: "Tabelas de preço" },
  { to: "/produtos", label: "Produtos" },
  { to: "/vendedores", label: "Vendedores" },
  { to: "/comissao", label: "Comissões e metas" },
  { to: "/clientes", label: "Clientes" },
  { to: "/visitas", label: "Visitas em campo" },
  { to: "/rastreio", label: "Rastreio ao vivo" },
  { to: "/vendas", label: "Vendas" },
  { to: "/relatorios", label: "Relatórios" },
];

export const MANAGER_NAV: NavItem[] = [
  { to: "/", label: "Início", end: true },
  { to: "/rastreio", label: "Rastreio ao vivo" },
  { to: "/visitas", label: "Visitas em campo" },
  { to: "/vendas", label: "Vendas" },
];

export function navForRole(role: Role | undefined): NavItem[] {
  return role === "MANAGER" ? MANAGER_NAV : DASHBOARD_NAV;
}
