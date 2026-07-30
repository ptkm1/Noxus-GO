# Integração Asaas — contratação PedixPro

Checkout recorrente hospedado (Sandbox/produção) no fluxo de contratação da landing. A conta só é ativada via webhook — o retorno do browser nunca ativa.

## Fluxo

1. Landing (`CheckoutForm`) envia `POST /api/v1/billing/subscription-intents` (sem senha).
2. API cria organização `PENDING_PAYMENT`, usuário admin pendente (`activatedAt = null`), `CheckoutIntent` e checkout Asaas (`chargeTypes: RECURRENT`, cartão).
3. Landing redireciona para `checkoutUrl` (host Asaas validado).
4. Após pagamento, Asaas notifica `POST /api/v1/webhooks/asaas` com header `asaas-access-token`.
5. Em `PAYMENT_CONFIRMED` (ou reconciliação `CHECKOUT_PAID`): org `ACTIVE`, assinatura `ACTIVE`, token de ativação + e-mail.
6. Admin define senha em `{APP}/ativar-conta?token=…` → login no ERP.
7. Página `{LANDING}/contratacao/processando?intentId=…` faz polling do status público.

```
Landing → API (intent) → Asaas checkout → Webhook PAYMENT_CONFIRMED → e-mail → /ativar-conta
```

## Variáveis de ambiente

| Variável                                                 | Descrição                                          |
| -------------------------------------------------------- | -------------------------------------------------- |
| `ASAAS_API_KEY`                                          | Token API (`access_token`)                         |
| `ASAAS_BASE_URL`                                         | Padrão sandbox: `https://api-sandbox.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN`                                    | Valor esperado no header `asaas-access-token`      |
| `ASAAS_ENVIRONMENT`                                      | `sandbox` \| `production`                          |
| `ASAAS_CHECKOUT_URL_PREFIX`                              | Prefixo permitido para redirect do browser         |
| `PEDIXPRO_LANDING_URL` / `SITE_PUBLIC_URL`               | Landing (callback processando)                     |
| `PEDIXPRO_APP_URL` / `WEB_PUBLIC_URL` / `WEB_APP_ORIGIN` | Painel (link ativar conta)                         |
| `SUBSCRIPTION_GRACE_PERIOD_DAYS`                         | Dias em `PAST_DUE` antes de `SUSPENDED` (padrão 7) |

Ver também `apps/api/.env.example`.

## Endpoints

| Método | Rota                                              | Auth                           |
| ------ | ------------------------------------------------- | ------------------------------ |
| `POST` | `/api/v1/billing/subscription-intents`            | Público + rate-limit           |
| `POST` | `/api/v1/billing/subscription-intents/:id/retry`  | Público + rate-limit           |
| `GET`  | `/api/v1/billing/subscription-intents/:id/status` | Público (payload seguro)       |
| `GET`  | `/api/v1/billing/plans`                           | Público                        |
| `POST` | `/api/v1/webhooks/asaas`                          | Token Asaas                    |
| `POST` | `/api/v1/auth/activate-account`                   | Público (`token` + `password`) |
| `POST` | `/api/v1/admin/billing/cancel`                    | ADMIN                          |

`POST /billing/checkout-intent` (stub) responde `410` — use subscription-intents.

## Eventos de webhook (MVP)

| Evento                                 | Efeito                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `PAYMENT_CONFIRMED`, `CHECKOUT_PAID`   | Ativa org/assinatura + e-mail de senha                       |
| `PAYMENT_OVERDUE`                      | `PAST_DUE` + grace period                                    |
| `CHECKOUT_EXPIRED`                     | Intent `EXPIRED`                                             |
| `SUBSCRIPTION_DELETED` / cancelamentos | `CANCELED`                                                   |
| Demais                                 | Persistidos como ignore (idempotentes via `providerEventId`) |

## Planos

IDs oficiais: `starter` \| `growth` \| `pro` (fonte: `packages/shared` `PLAN_CATALOG`). Sem aliases `*_monthly`.

## Gates de acesso

- Login exige `User.activatedAt != null`.
- Org `PENDING_PAYMENT` / `SUSPENDED` / `CANCELED`: staff bloqueado no web; mobile mostra mensagem neutra (sem preço/checkout).
- Inadimplência: webhook → `PAST_DUE` → após grace → `SUSPENDED` (check em entitlements/access).

## Convites e limites

Criação de usuário/vendedor sem senha (ou `invite: true`) gera `AccountActivationToken` (`USER_INVITE`). O limite `maxUsers` conta usuários ativos + convites pendentes.

## Checklist sandbox

1. Criar conta Asaas Sandbox e gerar API key + token de webhook.
2. Configurar webhook apontando para a API pública (`/api/v1/webhooks/asaas`), eventos de pagamento/assinatura/checkout.
3. Preencher envs na API e redeploy.
4. Na landing, contratar um plano de teste com cartão sandbox.
5. Confirmar e-mail de ativação e `/ativar-conta`.
6. Validar cancelamento de renovação em Configurações (ADMIN).

## Checklist produção

1. Trocar `ASAAS_BASE_URL`, `ASAAS_ENVIRONMENT=production`, prefixo de checkout e chave live.
2. Webhook em URL HTTPS estável; token forte e distinto da API key.
3. Conferir `PEDIXPRO_*` / `SITE_*` / `WEB_*` sem barra final.
4. Monitorar `PaymentProviderEvent` com `errorMessage` e intents `FAILED`.
5. E-mail transacional (Resend/SendGrid) obrigatório para ativação.

## Fora do MVP (documentado)

- Pix Automático / boleto recorrente
- Portal completo de faturas Asaas no ERP
- Onboarding wizard rico (hoje: pós-senha → `/` ou `/primeiro-acesso`)
- Preço anual / multi-moeda

## Testes

```bash
pnpm --filter @pedidos/api test
```

Unitários cobrem mappers Asaas, documento CPF/CNPJ, hash de token, catálogo de planos e `FakePaymentGateway` (sem HTTP real).
