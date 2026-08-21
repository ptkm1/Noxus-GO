#!/usr/bin/env bash
# Preflight de release: migrate no DB alvo + build API/Web.
# Uso:
#   DATABASE_URL='postgresql://...' ./scripts/release-preflight.sh
#   DATABASE_URL='postgresql://...' ./scripts/release-preflight.sh --migrate
#   DATABASE_URL='postgresql://...' ./scripts/release-preflight.sh --migrate --build
#
# Sem --migrate: só inspeciona status das migrations (não altera o banco).
# Com --migrate: roda `prisma migrate deploy`.
# Com --build: gera Prisma Client e compila shared + api + web.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DO_MIGRATE=0
DO_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --migrate) DO_MIGRATE=1 ;;
    --build) DO_BUILD=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Flag desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Defina DATABASE_URL do ambiente alvo (staging/prod)." >&2
  echo "Ex.: DATABASE_URL='postgresql://...' $0 --migrate --build" >&2
  exit 1
fi

# Evita acertar localhost sem querer em release.
HOST="$(node -e "try{console.log(new URL(process.env.DATABASE_URL).host)}catch{console.log('')}" )"
if [[ -z "$HOST" ]]; then
  echo "DATABASE_URL inválida." >&2
  exit 1
fi
if [[ "$HOST" == localhost* || "$HOST" == 127.0.0.1* ]]; then
  if [[ "${ALLOW_LOCAL_DB:-}" != "1" ]]; then
    echo "DATABASE_URL aponta para $HOST." >&2
    echo "Se for intencional: ALLOW_LOCAL_DB=1 $0 ..." >&2
    exit 1
  fi
fi

echo "==> Alvo: $HOST"
echo "==> Status das migrations"
# migrate status exit 1 = há pendências (esperado); não abortar o script.
set +e
pnpm exec dotenv -v DATABASE_URL="$DATABASE_URL" -v DIRECT_URL="${DIRECT_URL:-}" -- \
  prisma migrate status --config apps/api/prisma.config.ts
STATUS_RC=$?
set -e
if [[ "$STATUS_RC" -gt 1 ]]; then
  echo "migrate status falhou (rc=$STATUS_RC)" >&2
  exit "$STATUS_RC"
fi

if [[ "$DO_MIGRATE" -eq 1 ]]; then
  echo "==> migrate deploy"
  pnpm exec dotenv -v DATABASE_URL="$DATABASE_URL" -v DIRECT_URL="${DIRECT_URL:-}" -- \
    bash scripts/prisma-migrate-deploy.sh
  echo "==> Status após migrate"
  set +e
  pnpm exec dotenv -v DATABASE_URL="$DATABASE_URL" -v DIRECT_URL="${DIRECT_URL:-}" -- \
    prisma migrate status --config apps/api/prisma.config.ts
  set -e
else
  echo "(pula migrate — passe --migrate para aplicar)"
fi

if [[ "$DO_BUILD" -eq 1 ]]; then
  echo "==> prisma generate"
  pnpm exec dotenv -v DATABASE_URL="$DATABASE_URL" -- \
    prisma generate --config apps/api/prisma.config.ts
  echo "==> build shared"
  pnpm --filter @pedidos/shared run build
  echo "==> build api"
  pnpm --filter @pedidos/api run build
  echo "==> build web"
  pnpm --filter @pedidos/web run build
  echo "==> build site"
  pnpm --filter @pedidos/site run build
else
  echo "(pula build — passe --build para compilar)"
fi

echo ""
echo "OK. Ordem sugerida de publicação:"
echo "  1) migrate deploy (já feito se usou --migrate)"
echo "  2) redeploy da API no Render (serviço Nexus-GO — api.pedixpro.com.br)"
echo "  3) redeploy site (Vercel apps/site) e painel (Vercel apps/web)"
echo "  4) app mobile: eas build --profile production (Android/iOS)"
echo "  5) smoke: login, planos/billing, pedidos, faturamento"
echo ""
echo "Envs produção (checklist rápido):"
echo "  API Render: DATABASE_URL (Neon pooler), DIRECT_URL (Neon direto, sem -pooler), JWT_*, WEB_PUBLIC_URL=https://app.pedixpro.com.br"
echo "  Web Vercel: VITE_API_URL=https://api.pedixpro.com.br"
echo "  Site Vercel: NEXT_PUBLIC_API_URL=https://api.pedixpro.com.br NEXT_PUBLIC_APP_URL=https://app.pedixpro.com.br"
echo "  Mobile: EXPO_PUBLIC_API_URL=https://api.pedixpro.com.br"
