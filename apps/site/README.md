# @pedidos/site

Landing pública PedixPro (planos + checkout intent stub).

```bash
# na raiz do monorepo
pnpm install
pnpm build:shared
pnpm build:design-tokens
pnpm dev:site
```

Abre em http://localhost:3001.

## Catálogo de planos

Edite **apenas** `packages/shared/src/plans.ts` (`PLAN_CATALOG`). A landing e a API leem dessa fonte — não duplique features/preços aqui.

Variáveis locais: veja `.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`).

---

## Deploy Vercel (domínio + painel)

Arquitetura recomendada: **dois projetos Vercel** no mesmo monorepo Git.

| Domínio | App | Root Directory | Framework |
| --- | --- | --- | --- |
| `pedixpro.com.br` + `www` | `@pedidos/site` (este) | `apps/site` | Next.js |
| `app.pedixpro.com.br` | `@pedidos/web` | `apps/web` | Vite (SPA) |

Sugestão de nome do painel: **`app.pedixpro.com.br`** (comum em SaaS). A landing já aponta “Entrar” / “Acessar o painel” para `NEXT_PUBLIC_APP_URL` + `/login`.

Não é necessário configurar build na Vercel manualmente: `apps/site/vercel.json` define install/build do monorepo. O painel Vite usa `apps/web/vercel.json` (rewrite SPA + build).

### Projeto 1 — Site (apex)

1. Vercel → **Add New Project** → mesmo repositório.
2. **Root Directory:** `apps/site`.
3. Framework Preset: **Next.js**.
4. Incluir arquivos fora do Root Directory no build (monorepo / workspaces) — opção do painel Vercel.
5. **Install Command:** `pnpm install` (a partir da raiz do monorepo; a Vercel resolve o workspace).
6. **Build Command** (exemplo):

   ```bash
   pnpm build:shared && pnpm build:design-tokens && pnpm --filter @pedidos/site build
   ```

7. **Output:** deixe o padrão do Next (não force `dist`).
8. Domínios do projeto: `pedixpro.com.br` e `www.pedixpro.com.br`.

**Envs (Production):**

| Variável | Exemplo |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.pedixpro.com.br` |
| `NEXT_PUBLIC_APP_URL` | `https://app.pedixpro.com.br` |

### Projeto 2 — Painel (subdomínio)

1. Outro projeto Vercel → mesmo repositório.
2. **Root Directory:** `apps/web`.
3. Framework Preset: **Vite** (ou Other).
4. Monorepo / arquivos fora do Root Directory: habilitado.
5. **Build Command** (exemplo):

   ```bash
   pnpm build:shared && pnpm build:design-tokens && pnpm --filter @pedidos/web build
   ```

6. **Output Directory:** `dist`.
7. Domínio: `app.pedixpro.com.br`.
8. Confirme que `apps/web/vercel.json` está presente (rewrite SPA).

**Envs (Production):**

| Variável | Exemplo |
| --- | --- |
| `VITE_API_URL` | `https://api.pedixpro.com.br` |
| `VITE_WEB_APP_URL` | `https://app.pedixpro.com.br` |

### DNS no registrador

No painel do domínio, use os registros que a **própria Vercel** mostra ao adicionar cada hostname (não invente IPs):

| Hostname | Tipo típico | Valor |
| --- | --- | --- |
| `pedixpro.com.br` (apex) | **A** (ou ALIAS/ANAME se o registrador oferecer) | IP(s) indicados pela Vercel |
| `www` | **CNAME** | `cname.vercel-dns.com` (ou o alvo que a Vercel exibir) |
| `app` | **CNAME** | mesmo alvo CNAME da Vercel |

Depois valide os domínios no painel de cada projeto até ficarem **Valid**.

### API (Render) — origens públicas

Na API, alinhe redirects/links/CORS com os mesmos hosts:

| Variável | Aponta para |
| --- | --- |
| `WEB_APP_ORIGIN` / `WEB_PUBLIC_URL` | `https://app.pedixpro.com.br` (painel) |
| `SITE_PUBLIC_URL` | `https://pedixpro.com.br` (landing) |

Reinicie/redeploy a API após alterar envs.
