# API HTTP

Base: `http://localhost:4000/api` (em dev, o Vite faz proxy em `/api`). Autenticação: `Authorization: Bearer <jwt>`.

## Público

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | healthcheck (fora de `/api`) |
| GET | `/catalog/public` | configurações públicas, provedor de pagamento e features |
| GET | `/catalog/categories` | categorias ativas |
| GET | `/catalog/establishments?q=&category=&sort=&open=&lat=&lng=` | busca/filtros |
| GET | `/catalog/establishments/:slug` | loja + cardápio + avaliações |
| GET | `/catalog/products/:id` | produto com grupos/opções |
| GET | `/catalog/cep/:cep` | ViaCEP real (falha explícita se indisponível) |
| POST | `/auth/register` | consumidor, estabelecimento ou entregador |
| POST | `/auth/login` | login com bloqueio após 5 falhas (15 min) |

## Autenticado

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| GET/PATCH | `/auth/me` | todos | dados do usuário |
| GET | `/auth/notifications` | todos | notificações internas |
| PATCH | `/auth/notifications/read` | todos | marcar como lidas |
| GET | `/auth/lgpd/export` | todos | portabilidade de dados |
| POST | `/auth/lgpd/delete-request` | todos | solicitação de exclusão |
| CRUD | `/addresses` | todos | endereços |
| POST | `/orders` | consumer | criar pedido (preços calculados no servidor) |
| GET | `/orders/mine`, `/orders/:id` | consumer/loja/entregador/admin | acompanhamento |
| POST | `/orders/:id/cancel`, `/orders/:id/review` | consumer | cancelar/avaliar |
| POST | `/orders/favorites/:id`, GET `/orders/meta/favorites` | consumer | favoritos |
| POST | `/payments/orders/:id/initialize` | consumer | iniciar pagamento (header `Idempotency-Key`) |
| GET | `/payments/orders/:id` | participantes | pagamento e transações |
| POST | `/payments/:id/confirm-manual` | merchant/admin | confirmação explícita de dinheiro/PIX manual |
| POST | `/payments/:id/refund` | admin | bloqueado: estorno não implementado para produção |
| POST | `/webhooks/:provider` | provedor | bloqueado até implementação e homologação |
| GET/POST/PATCH/DELETE | `/products` | merchant | cardápio, grupos e adicionais |
| GET/PATCH | `/merchant/me`, `/merchant/dashboard`, `/merchant/orders`, `/merchant/finance`, `/merchant/coupons`, `/merchant/settings` | merchant | portal |
| POST | `/merchant/orders/:id/accept`, `/reject`, `/status`, `/request-courier` | merchant | operação |
| GET/PATCH | `/couriers/me`, `/couriers/offers`, `/couriers/deliveries`, `/couriers/earnings` | courier | app do entregador |
| POST | `/couriers/offers/:id/accept` | courier | aceite atômico (sem dupla designação) |
| POST | `/couriers/deliveries/:id/{picked,depart,delivered,location}` | courier | execução |
| GET/PATCH/POST | `/admin/*` | admin | gestão completa (ver `routes.ts`) |
| GET/POST | `/chat/conversations`, `/chat/conversations/:id/messages` | participantes | chat persistente por pedido |
| POST/GET/PATCH | `/chat/support` | todos/admin | chamados e denúncias |

Erros seguem `{ error, code, details? }`. Validação Zod retorna `validation_error` com caminhos dos campos.

## WebSocket

`ws://host/ws?token=<jwt>` — eventos: `notification`, `order:updated`, `message:new`, `delivery:offer`, `delivery:updated`, `delivery:location`, `payment:updated`.
