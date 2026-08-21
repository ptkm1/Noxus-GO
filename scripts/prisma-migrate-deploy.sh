#!/usr/bin/env bash
# prisma migrate deploy na conexão DIRETA (sem PgBouncer / Neon -pooler).
# Runtime da API continua usando DATABASE_URL (pooler) no processo de start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}${DIRECT_URL:-}${DATABASE_URL_UNPOOLED:-}" ]]; then
  if [[ -f apps/api/.env ]]; then
    exec pnpm exec dotenv -e apps/api/.env -- bash "$0" "$@"
  fi
  echo "Defina DIRECT_URL (host Neon sem -pooler) ou DATABASE_URL." >&2
  exit 1
fi

RESOLVED="$(
  pnpm exec tsx -e "import { resolveMigrateDatabaseUrl } from './apps/api/prisma-direct-url.ts'; process.stdout.write(resolveMigrateDatabaseUrl())"
)"
# Só neste processo (start da API no Render continua com o DATABASE_URL pooled).
export DATABASE_URL="$RESOLVED"
export DIRECT_URL="$RESOLVED"
echo "==> prisma migrate deploy (conexão direta: $(node -e 'console.log(new URL(process.env.DATABASE_URL).host)'))"
exec pnpm exec prisma migrate deploy --config apps/api/prisma.config.ts
