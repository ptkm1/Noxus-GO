import type { AccessPayload } from "../auth/jwt.js";
import { teamMemberSellerIds } from "../auth/org-roles.js";

export type MobileReportScope = "own" | "team" | "org";

/**
 * Escopo de vendedores para relatórios no app:
 * - ADMIN → org inteira (`sellerIds` omitido)
 * - Líder + `scope=team` → membros da equipe
 * - Caso contrário → só o próprio sellerId
 */
export async function resolveMobileReportSellerIds(
  auth: AccessPayload,
  scopeRaw?: string | null,
): Promise<{ sellerIds: string[] | undefined; scope: MobileReportScope }> {
  if (auth.role === "ADMIN") {
    return { sellerIds: undefined, scope: "org" };
  }

  if (!auth.sellerId) {
    throw new Error("SELLER_REQUIRED");
  }

  const wantsTeam =
    (scopeRaw === "team" || scopeRaw === "TEAM") &&
    Boolean(auth.teamLeaderTeamId);

  if (wantsTeam && auth.teamLeaderTeamId) {
    const ids = await teamMemberSellerIds(auth.teamLeaderTeamId);
    return {
      sellerIds: ids.length > 0 ? ids : [auth.sellerId],
      scope: "team",
    };
  }

  return { sellerIds: [auth.sellerId], scope: "own" };
}
