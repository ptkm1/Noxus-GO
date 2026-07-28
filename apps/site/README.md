# @pedidos/site

Landing pública PedixPro (planos + checkout intent stub).

```bash
# na raiz do monorepo
pnpm install
pnpm build:shared
pnpm dev:site
```

Abre em http://localhost:3001.

## Catálogo de planos

Edite **apenas** `packages/shared/src/plans.ts` (`PLAN_CATALOG`). A landing e a API leem dessa fonte — não duplique features/preços aqui.

Variáveis: veja `.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`).
