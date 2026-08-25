/**
 * Destino do botão «Voltar» no cabeçalho do painel.
 * `null` quando já estamos na raiz (`/`).
 */
export function dashboardBackTarget(pathname: string): string | null {
  const raw = pathname.replace(/\/+$/, "") || "/";
  if (raw === "/") return null;

  // Edição de produto: /produtos/:id/editar → lista de produtos
  if (/^\/produtos\/[^/]+\/editar$/.test(raw)) return "/produtos";

  // Indicadores: filhos voltam ao hub
  if (raw === "/insights" || raw === "/relatorios") return "/indicadores";

  const slash = raw.lastIndexOf("/");
  if (slash <= 0) return "/";
  return raw.slice(0, slash) || "/";
}
