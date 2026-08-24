# Integração Asaas — contratação PedixPro

Checkout recorrente hospedado (Sandbox/produção). O cadastro no painel (`/cadastro`) entra em **trial de 7 dias** sem pagamento. A contratação da landing e o paywall **depois** do trial só liberam (ou reabrem) o ERP após webhook Asaas. O retorno do browser nunca ativa sozinho.

## Fluxo do usuário (conta nova no app)

1. `/cadastro`: CNPJ, dados do admin, senha e **plano** (preços do `PLAN_CATALOG`).
2. `POST /auth/register` cria org `ACTIVE` + assinatura `TRIAL` com `currentPeriodEnd` = agora + 7×24h (UTC; UI em America/Sao_Paulo). Sem checkout Asaas. `requiresPayment` é `false`.
3. Admin entra no painel na hora. Convites na mesma empresa **não** ganham trial novo.
4. Cada organização nova tem o próprio trial de 7 dias.
5. Quando o trial expira, `syncOrgAccessFromSubscription` passa a org para `PENDING_PAYMENT` (dados preservados). Admin autenticado vai para `/pagamento` e pode assinar.
6. Webhook `POST /api/v1/webhooks/asaas` (`asaas-access-token`) ativa a assinatura (`ACTIVE`) após o pagamento.

A landing (`CheckoutForm` → `POST /billing/subscription-intents`) continua cobrando na hora: org pendente, senha só depois do e-mail de ativação. Se alguém pagar nesse caminho, a assinatura fica `ACTIVE`.

Upgrade logado: Configurações → Assinar / mudar plano → `POST /billing/checkout` (não bloqueia trial existente até o pagamento).

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `PAYMENT_GATEWAY` | `auto` (padrão) ou `asaas` |
| `ASAAS_API_KEY` | Token API (`access_token` header). Sem isso, `auto` não cria checkout; o cadastro no app continua com trial de 7 dias |
| `ASAAS_BASE_URL` | Padrão sandbox: `https://api-sandbox.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN` | Valor esperado no header `asaas-access-token` |
| `ASAAS_ENVIRONMENT` | `sandbox` \| `production` |
| `ASAAS_CHECKOUT_URL_PREFIX` | Prefixo permitido para redirect do browser |
| `PEDIXPRO_LANDING_URL` / `SITE_PUBLIC_URL` | Landing (callback contratação) |
| `PEDIXPRO_APP_URL` / `WEB_PUBLIC_URL` / `WEB_APP_ORIGIN` | Painel (`/pagamento`, ativar conta) |
| `SUBSCRIPTION_GRACE_PERIOD_DAYS` | Dias em `PAST_DUE` antes de `SUSPENDED` (padrão 7) |

Pagamento local usa Asaas sandbox (cartão/webhook reais do sandbox). Não há simulação que marque como pago sem cobrar.

Ver também `apps/api/.env.example`.

```
App /cadastro → POST /auth/register → trial 7 dias → (depois) /pagamento → Webhook → painel
Landing → POST /billing/subscription-intents → Asaas → Webhook → e-mail → /ativar-conta
```

## Endpoints

| Método | Rota | Auth |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Público (trial 7 dias; sem checkout) |
| `POST` | `/api/v1/billing/subscription-intents` | Público + rate-limit |
| `POST` | `/api/v1/billing/subscription-intents/:id/retry` | Público + rate-limit |
| `GET` | `/api/v1/billing/subscription-intents/:id/status` | Público (payload seguro) |
| `GET` | `/api/v1/billing/plans` | Público |
| `GET` | `/api/v1/billing/checkout/open` | ADMIN |
| `POST` | `/api/v1/billing/checkout` | ADMIN |
| `POST` | `/api/v1/billing/cancel` | ADMIN |
| `POST` | `/api/v1/webhooks/asaas` | Token Asaas |
| `POST` | `/api/v1/auth/activate-account` | Público (`token` + `password`) |

`POST /billing/checkout-intent` (stub) responde `410` — use subscription-intents.

## Eventos de webhook (MVP)

| Evento | Efeito |
| --- | --- |
| `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `CHECKOUT_PAID` | Ativa org/assinatura (+ e-mail de senha se a conta ainda não foi ativada) |
| `PAYMENT_OVERDUE` | `PAST_DUE` + grace period |
| `CHECKOUT_EXPIRED` | Intent `EXPIRED` |
| `SUBSCRIPTION_DELETED` / cancelamentos | `CANCELED` |
| Demais | Persistidos como ignore (idempotentes via `providerEventId`) |

## Planos

IDs oficiais: `start` \| `pro` \| `business` (fonte: `packages/shared` `PLAN_CATALOG`). Sem aliases `*_monthly`. Mensalidade = base do plano + R$ 29,90 por vendedor + R$ 29,90 por acesso administrativo extra.

## Gates de acesso

- Login exige `User.activatedAt != null`.
- Cadastro no painel: org `ACTIVE` + assinatura `TRIAL` por 7 dias (`canUseApp`).
- Trial expirado ou org `PENDING_PAYMENT`: admin pode autenticar só para `/pagamento`; demais roles bloqueados.
- `SUSPENDED` / `CANCELED`: staff bloqueado; mobile mostra mensagem neutra.
- Inadimplência: webhook → `PAST_DUE` → após grace → `SUSPENDED`.

## Convites e limites

Criação de usuário/vendedor sem senha (ou `invite: true`) gera `AccountActivationToken` (`USER_INVITE`). Vendedores são ilimitados e entram na cobrança (R$ 29,90/mês cada). Acessos administrativos (ADMIN/MANAGER) inclusos: Start 1, Pro 2, Business 6; extras também R$ 29,90/mês. O valor da assinatura Asaas é atualizado ao adicionar/remover assentos.

## Checklist sandbox

1. Criar conta Asaas Sandbox e gerar API key + token de webhook.
2. Configurar webhook apontando para a API pública (`/api/v1/webhooks/asaas`), eventos de pagamento/assinatura/checkout.
3. Preencher envs na API e redeploy.
4. No app, criar conta em `/cadastro` (entra no trial) e, se quiser, assinar em Configurações ou após o 7º dia em `/pagamento`. Conferir webhook + painel.
5. Na landing, contratar um plano de teste (fluxo com e-mail de senha).
6. Validar cancelamento de renovação em Configurações (ADMIN).

## Checklist produção

1. Trocar `ASAAS_BASE_URL`, `ASAAS_ENVIRONMENT=production`, prefixo de checkout e chave live.
2. Webhook em URL HTTPS estável; token forte e distinto da API key.
3. Conferir `PEDIXPRO_*` / `SITE_*` / `WEB_*` sem barra final.
4. Monitorar `PaymentProviderEvent` com `errorMessage` e intents `FAILED`.
5. E-mail transacional (Resend/SendGrid) obrigatório para ativação.

## Fora do MVP (documentado)

- Pix Automático / boleto como recorrência nativa (o checkout já oferece Pix/boleto na 1ª cobrança + cartão recorrente)
- Portal completo de faturas Asaas no ERP
- Onboarding wizard rico (hoje: pós-senha → `/` ou `/primeiro-acesso`)
- Preço anual / multi-moeda

## Testes

```bash
pnpm --filter @pedidos/api test
```

Unitários cobrem mappers Asaas, documento CPF/CNPJ, hash de token, catálogo de planos e `FakePaymentGateway` (sem HTTP real).
