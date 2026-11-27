# Arquitetura e modelo de dados

## Decisões técnicas

| Camada | Escolha | Justificativa |
|---|---|---|
| API | Node 22 + TypeScript + Express | Ecossistema maduro, baixa sobrecarga, compatível com WebSocket. |
| Tempo real | `ws` com salas por usuário | Mesmo canal para pedidos, chat, ofertas e notificações. |
| Banco | SQLite nativo (`node:sqlite`) em dev/test | Persistência real sem serviço externo; WAL + FK + transações ACID. |
| Produção | PostgreSQL recomendado | Ver plano de migração abaixo. |
| Web | React + Vite + Tailwind | Build rápido, componentes reutilizáveis e responsividade. |
| Mobile | Expo (React Native) | Um código para Android/iOS; mesmo backend e contratos. |
| Shared | TypeScript puro | Regras de cálculo e tipos sem duplicação, sem acoplar UI. |

### Por que não Prisma/PostgreSQL no bootstrap?

O sandbox não fornece PostgreSQL gerenciado e o download de engines do Prisma não é garantido. Usar o SQLite nativo do Node permite **entregar um sistema persistente e executável agora**, com o mesmo modelo relacional. A camada de acesso está concentrada em `apps/api/src/db/index.ts` com helpers `all/get/run/tx`, o que reduz o esforço de migração: substituir placeholders `?` por `$n` e trocar o driver. Schema é ANSI-ish com CHECK/UNIQUE/índices; a migração deve ser feita com Prisma Migrate ou SQL traduzido antes de escalar horizontalmente (SQLite é single-writer). **Isso está pendente e deve ser feito antes de tráfego relevante.**

## Módulos

```
Consumer  -> /api/catalog, /api/orders, /api/addresses, /api/chat
Merchant  -> /api/merchant, /api/products, /api/payments/:id/confirm-manual
Courier   -> /api/couriers
Admin     -> /api/admin
Payments  -> /api/payments, /api/webhooks/:provider
Realtime  -> /ws
```

## Entidades principais

`users`, `addresses`, `categories`, `establishments`, `products`, `product_option_groups`, `product_options`, `coupons`, `orders`, `order_items`, `order_status_history`, `couriers`, `deliveries`, `delivery_locations`, `conversations`, `messages`, `payments`, `transactions`, `commissions`, `payouts`, `refunds`, `webhook_events`, `reviews`, `favorites`, `notifications`, `support_tickets`, `audit_logs`, `app_settings`, `login_attempts`.

Integridade: `FOREIGN KEY` com cascade where apropriado, `UNIQUE` em e-mail/documento/slug/código de cupom/`order_id` em pagamentos e comissões, `CHECK` em status/ratings/valores e índices nas consultas frequentes.

## Fluxo financeiro (sem duplicidade)

1. Pedido é criado com preços **recalculados no backend** (produto + adicionais - desconto + entrega).
2. Pagamento é registrado em `payments` com chave de idempotência única e `transactions`.
3. Ao confirmar pagamento (webhook assinado ou confirmação manual explícita), `orders.payment_status = approved`.
4. Ao entregar, `settleOrder()` calcula comissão usando alíquotas vigentes da loja e grava **uma** linha em `commissions` (`UNIQUE order_id`), além de `payouts` para loja e entregador.
5. Estornos geram `refunds` + transação; o administrador vê conciliação em `/api/admin/finance`.

## Limitações atuais documentadas

- Web Push/VAPID não enviado (credenciais ausentes); notificações internas + WebSocket funcionam.
- Upload de imagens usa URLs públicas (storage/CDN a configurar).
- Geocodificação reversa/avançada depende de provedor externo; CEP usa ViaCEP e distância é haversine.
- SQLite deve ser migrado para PostgreSQL antes de alta concorrência.
