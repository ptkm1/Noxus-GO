/**
 * URL usada pelo Prisma CLI (migrate / studio). Runtime da API continua em DATABASE_URL (pooler).
 * Neon pooler: ep-xxx-pooler.region.aws.neon.tech — advisory lock (P1002) falha no PgBouncer.
 */

const POOLER_HOST = /-pooler(?=\.)/i;

function firstDefined(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function toDirectPostgresUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL Postgres inválida (DIRECT_URL / DATABASE_URL).");
  }

  url.hostname = url.hostname.replace(POOLER_HOST, "");
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "60");
  }
  return url.toString();
}

export function resolveMigrateDatabaseUrl(
  env: NodeJS.Dict<string> = process.env,
): string {
  const raw = firstDefined(
    env.DIRECT_URL,
    env.DATABASE_URL_UNPOOLED,
    env.DATABASE_URL,
  );
  if (!raw) {
    throw new Error(
      "Defina DIRECT_URL (recomendado), DATABASE_URL_UNPOOLED ou DATABASE_URL para o Prisma CLI.",
    );
  }

  const direct = toDirectPostgresUrl(raw);
  const host = new URL(direct).hostname;
  if (/-pooler/i.test(host)) {
    throw new Error(
      `URL de migrate ainda aponta para pooler (${host}). No Neon, use o host direto (sem "-pooler") em DIRECT_URL.`,
    );
  }
  return direct;
}

export function migrateDatasourceHost(url: string): string {
  return new URL(url).host;
}
