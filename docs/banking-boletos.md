# Conciliação bancária de boletos (clientes)

Recebíveis dos **clientes da empresa usuária do Pedix** — distinto da assinatura SaaS Asaas (`docs/asaas-integration.md`).

## Arquitetura

```
App / CreditService / ReceivableService
        │
        ▼
  BankingProvider  (abstração)
   ├── ItauProvider        (stub tipado — portal mTLS)
   ├── BancoDoBrasilProvider (OAuth + GET boletos; POST stub)
   └── SantanderProvider   (OAuth + bank_slips / webhook)
```

- Models: `BankConnection`, `Receivable`, `BankingWebhookEvent`
- Crédito na confirmação do pedido: **só PostgreSQL local** (`checkCustomer` / `evaluateOrderCredit`) — inclui títulos manuais + boletos vencidos
- Webhooks: `POST /api/v1/webhooks/banking/:provider` (ITAU|BB|SANTANDER), token `x-banking-webhook-token`
- Sync fallback: `POST /admin/receivables/:id/sync` e job `POST /jobs/banking-reconcile` (CRON_SECRET)
- CNAB: campo `cnabEnabled` reservado — **não implementado**

## UI

Financeiro → Integrações bancárias (`/financeiro/integracoes-bancarias`).
Cliente: Em dia / Em aberto / Inadimplente.
Pedido: preview de crédito com boletos vencidos quando bloqueado.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `BANKING_ENCRYPTION_KEY` | AES-GCM (opcional; fallback `FISCAL_ENCRYPTION_KEY`) |
| `BANKING_ENVIRONMENT` | `sandbox` (padrão) \| `production` |
| `BANKING_{PROVIDER}_WEBHOOK_TOKEN` | Token global opcional do provedor |
| `BANKING_SANTANDER_ALLOW_UNSIGNED_WEBHOOK` | `1` só em sandbox se o banco autenticar só via mTLS |
| `BANKING_ALLOW_BODY_SECRETS` | `1` para aceitar secrets no body em production (evitar) |
| Prefixo por org | Ex.: `BANKING_SANTANDER_ACME_CLIENT_ID`, `_CLIENT_SECRET`, `_APP_KEY`, `_WORKSPACE_ID`, `_COVENANT_CODE`, `_WEBHOOK_SECRET` |

Secrets **nunca** vão ao frontend. Preferir `credentialsEnvPrefix` na conexão.

## Credenciais por banco (homologação manual)

### Itaú

Portal: [devportal.itau.com.br](https://devportal.itau.com.br/)

- Solicitar ao gerente / API Owner credenciais de **Cobranças**
- Auth: OAuth client_credentials + **mTLS** (certificado dinâmico STS)
- Token ~5 min (`sts.itau.com.br`)
- Necessário: `CLIENT_ID`, `CLIENT_SECRET`, `CERT_PEM`, `KEY_PEM`, webhook se disponível
- **Status Pedix:** stub — endpoints de cobrança atrás do portal; sem fake-pay em produção

### Banco do Brasil

Portal: [developers.bb.com.br](https://developers.bb.com.br/) / [API Cobrança](https://bb.com.br/site/developers/api-cobranca/)

- Criar app no portal → `CLIENT_ID`, `CLIENT_SECRET`, `APP_KEY` (developer_application_key)
- OAuth: `https://oauth.bb.com.br/oauth/token` (prod) / `oauth.hm.bb.com.br` (homolog)
- API: `https://api.bb.com.br/cobrancas/v2` / `api.hm.bb.com.br`
- Header: `gw-dev-app-key`
- **Status Pedix:** OAuth + `GET /boletos/{id}`; `POST` de registro aguarda payload da OpenAPI homologada

### Santander

Portal: [developer.santander.com.br](https://developer.santander.com.br)

- App + certificado mTLS → `CLIENT_ID`, `CLIENT_SECRET`
- Criar **Workspace** (`POST .../collection_bill_management/v2/workspaces`) com `covenants`, `webhookURL`, `bankSlipBillingWebhookActive`
- Guardar `workspaceId` + `covenantCode` nos metadados da conexão
- OAuth: `trust-open.api.santander.com.br/auth/oauth/v2/token` (prod) / trust-sandbox (sandbox)
- Boletos: `.../workspaces/{id}/bank_slips`
- Status: Ativo → PENDING; Liquidado → PAID; Liquidado parcialmente → PARTIALLY_PAID; Baixado → CANCELLED
- **Status Pedix:** create/get/webhook tipados; mTLS no agent HTTP pode ser necessário em produção

## Checklist de go-live

1. Contratar cobrança API com o gerente do banco
2. Sandbox: credenciais + certificado (Itaú/Santander)
3. Cadastrar webhook HTTPS público apontando para `/api/v1/webhooks/banking/{provider}?connectionId=...`
4. Criar `BankConnection` no painel (metadados + prefixo env)
5. Emitir boleto de teste / importar `externalId` e validar webhook + sync
6. Homologação formal do banco → production
7. Ajustar `creditPolicy` da org (WARN_ONLY / BLOCK_ORDER / REQUIRE_APPROVAL)

## Endpoints úteis

| Método | Rota | Auth |
| --- | --- | --- |
| GET/POST | `/api/v1/admin/banking/connections` | Staff |
| POST | `/api/v1/admin/banking/connections/:id/sync` | Staff |
| GET/POST | `/api/v1/admin/receivables` | Staff |
| POST | `/api/v1/admin/receivables/:id/sync` | Staff |
| GET | `/api/v1/admin/customers/:id/credit-check` | Staff |
| POST | `/api/v1/webhooks/banking/:provider` | Token banco |
| POST | `/api/v1/jobs/banking-reconcile` | CRON_SECRET |
