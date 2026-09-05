# Conciliação e emissão de boletos (clientes)

Recebíveis dos **clientes da empresa usuária do Pedix** — distinto da assinatura SaaS Asaas (`docs/asaas-integration.md`).

Boleto = model `Receivable` (sem model paralelo). Histórico em `ReceivableEvent`.

## Arquitetura

```
App / BoletoEmissionService / ReceivableService
        │
        ▼
  BankingProvider  (abstração)
   ├── ItauProvider           (OAuth + mTLS; paths configuráveis)
   ├── BancoDoBrasilProvider  (OAuth + create/get/cancel)
   └── SantanderProvider      (OAuth + bank_slips; mTLS opcional)
```

- Models: `BankConnection`, `Receivable`, `ReceivableEvent`, `BankingWebhookEvent`
- Crédito na confirmação do pedido: **só PostgreSQL local** — inclui títulos manuais + boletos vencidos
- Webhooks: `POST /api/v1/webhooks/banking/:provider` (ITAU|BB|SANTANDER), token `x-banking-webhook-token`
- Sync fallback: `POST /admin/boletos/:id/sync`, `POST /admin/receivables/:id/sync`, job `POST /jobs/banking-reconcile` (CRON_SECRET)
- CNAB / Pluggy / Asaas / emissão automática no confirm order: **fora de escopo**

## Fluxo de emissão

1. Pedido `CONFIRMED` com condição a prazo (`days > 0` ou `installmentDays` preenchido)
2. Cliente com CPF/CNPJ; conexão `ACTIVE` com `capabilities.createBoleto`
3. `POST /admin/boletos/emit` (ou `emit-all`) cria `Receivable` por parcela, chama o banco, grava evento `EMIT`
4. Cliente recebe `openPdfIds` → UI abre PDF (`GET /admin/boletos/:id/pdf`)
5. Se o banco não devolver PDF → gerador interno (pdfkit) com linha digitável

Parcelas: `PaymentCondition.installmentDays` (ex. `[30,60,90]`); se vazio, usa `days` como parcela única. Rateio em centavos (última parcela absorve resto). Anti-duplicidade: `orderId + installmentIndex` com status ≠ `CANCELLED`.

## Capabilities por banco

| Banco | create | get | cancel | update | pdf | live |
| --- | --- | --- | --- | --- | --- | --- |
| Santander | ✓ (credenciais) | ✓ | ✓ | — | URL se API devolver | OAuth (+ mTLS se CERT/KEY) |
| BB | ✓ | ✓ | ✓ | — | interno | OAuth + APP_KEY |
| Itaú | ✓ | ✓ | ✓ | — | interno | OAuth + mTLS; paths via metadata |

`editableFields` vazio nos três (update não documentado publicamente). Reemissão = cancel + emit da mesma parcela.

## UI

- **Emissão de boletos** → `/emissao-boletos` (também `/financeiro/boletos`)
- Permissão resource `boletos` (ADMIN write por default)
- Financeiro hub → card Emissão + Integrações bancárias (`/financeiro/integracoes-bancarias`)
- Condições de pagamento: campo opcional **Parcelas (dias)** = `installmentDays`

## Variáveis de ambiente / secrets

| Variável | Descrição |
| --- | --- |
| `BANKING_ENCRYPTION_KEY` | AES-GCM (opcional; fallback `FISCAL_ENCRYPTION_KEY`) |
| `BANKING_ENVIRONMENT` | `sandbox` (padrão) \| `production` |
| `BANKING_{PROVIDER}_WEBHOOK_TOKEN` | Token global opcional do provedor |
| `BANKING_SANTANDER_ALLOW_UNSIGNED_WEBHOOK` | `1` só em sandbox se o banco autenticar só via mTLS |
| `BANKING_ITAU_ALLOW_UNSIGNED_WEBHOOK` | Idem para Itaú |
| `BANKING_ALLOW_BODY_SECRETS` | `1` para aceitar secrets no body em production (evitar) |
| Prefixo por org | Ex.: `BANKING_SANTANDER_ACME_CLIENT_ID`, `_CLIENT_SECRET`, `_APP_KEY`, `_WORKSPACE_ID`, `_COVENANT_CODE`, `_WEBHOOK_SECRET`, `_CERT_PEM`, `_KEY_PEM` |

Secrets **nunca** vão ao frontend. Preferir `credentialsEnvPrefix` na conexão.

### Itaú (metadata opcional)

- `beneficiaryId` (obrigatório para emit)
- `tokenUrl`, `apiBaseUrl`, `createPath`, `getPath`, `cancelPath`, `wallet`
- Secrets: `CLIENT_ID`, `CLIENT_SECRET`, `CERT_PEM`, `KEY_PEM`

### BB

- Secrets: `CLIENT_ID`, `CLIENT_SECRET`, `APP_KEY`
- Metadata/secret: `covenantCode` / `CONVENIO`, `wallet`, `walletVariation`

### Santander

- Secrets: `CLIENT_ID`, `CLIENT_SECRET` (+ `CERT_PEM`/`KEY_PEM` se mTLS)
- Metadata: `workspaceId`, `covenantCode`, `beneficiaryCode`

## Endpoints

| Método | Rota | Auth | Resource |
| --- | --- | --- | --- |
| GET | `/admin/boletos/eligible-orders` | Staff | boletos |
| GET | `/admin/boletos` | Staff | boletos |
| GET | `/admin/boletos/summary` | Staff | boletos |
| POST | `/admin/boletos/emit` | Staff write | boletos |
| POST | `/admin/boletos/emit-all` | Staff write | boletos |
| GET | `/admin/boletos/:id` | Staff | boletos |
| GET | `/admin/boletos/:id/pdf` | Staff | boletos |
| POST | `/admin/boletos/:id/sync` | Staff | boletos |
| PATCH | `/admin/boletos/:id` | Staff write | boletos |
| POST | `/admin/boletos/:id/cancel` | Staff write | boletos |
| POST | `/admin/boletos/:id/reissue` | Staff write | boletos |
| GET/POST | `/admin/banking/connections` | Staff | fiscal |
| GET/POST | `/admin/receivables` | Staff | fiscal |
| POST | `/admin/receivables/:id/sync` | Staff | fiscal |
| POST | `/webhooks/banking/:provider` | Token banco | — |
| POST | `/jobs/banking-reconcile` | CRON_SECRET | — |

Prefixo API: `/api/v1`.

## Checklist de go-live

1. Contratar cobrança API com o gerente do banco
2. Sandbox: credenciais + certificado (Itaú/Santander)
3. Cadastrar webhook HTTPS → `/api/v1/webhooks/banking/{provider}?connectionId=...`
4. Criar `BankConnection` (metadados + prefixo env)
5. Emitir boleto de teste e validar webhook + sync + PDF
6. Homologação formal → production (`metadata.environment`)
7. Ajustar `creditPolicy` da org
