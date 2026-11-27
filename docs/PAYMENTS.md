# Pagamentos e financeiro

## Regra fundamental

O sistema **não simula pagamento aprovado**. Sem um provedor configurado, apenas `pix_manual` e `cash` estão disponíveis e ficam **pendentes** até confirmação explícita do estabelecimento/administrador. Cartões e PIX online retornam erro claro (`payment_provider_not_configured`) quando `PAYMENTS_PROVIDER=none`.

## Provedores avaliados

| Provedor | Recursos usados | Status |
|---|---|---|
| Mercado Pago | PIX (`/v1/payments`), cartões via Preference, webhooks `x-signature`, reembolsos | Adaptador implementado; requer credenciais reais e conta marketplace/split |
| Pagar.me | Orders API v5 (PIX/cartão com token), webhook HMAC, reembolsos | Adaptador implementado; split rules preparadas mas vazias até configurar conta marketplace |

A escolha final depende da conta comercial do proprietário (taxas, habilitação de marketplace e split). O código isola isso em `apps/api/src/modules/payments/provider.ts`.

## Configuração

```bash
PAYMENTS_PROVIDER=mercadopago   # ou pagarme / none
MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_WEBHOOK_SECRET=...
WEBHOOK_BASE_URL=https://api.seu-dominio.com
```

Registre no painel do provedor a URL `https://api.seu-dominio.com/api/webhooks/mercadopago` (ou `/pagarme`). O webhook usa **corpo cru** e valida assinatura antes de qualquer gravação.

## Segurança e conciliação

- Nenhum número de cartão é enviado ao backend: cartões usam tokens/checkout do provedor (Pagar.me `card_token`, Mercado Pago Preference).
- `payments.idempotency_key` é `UNIQUE`; a cobrança é reutilizada quando a mesma chave é enviada.
- `webhook_events` é `UNIQUE(provider,event_id)`: eventos repetidos são ignorados.
- `payments.order_id` é `UNIQUE`: um pedido não pode ter dois pagamentos.
- `commissions.order_id` é `UNIQUE`: uma comissão por pedido, mesmo com reprocessamento.
- `transactions`, `refunds`, `payouts` e `audit_logs` registram toda movimentação.
- Cálculo: comissão sobre `subtotal - desconto` + comissão sobre taxa de entrega. Entregador recebe `taxa - comissão_entrega`. Exemplo R$100 + R$10 → plataforma R$8,80; entregador R$9,20; loja R$92,00 (antes de impostos/outras taxas).

## Pendências comerciais

- Habilitar split automático no provedor (Mercado Pago: `marketplace_fee`; Pagar.me: `split_rules`) para repasse direto a lojas/entregadores. Hoje os repasses são **registrados no ledger interno** e marcados como pagos pelo admin com ID externo.
- Taxas de processamento e regras de repasse devem ser refletidas nas alíquotas configuradas (`/api/admin/settings`).
