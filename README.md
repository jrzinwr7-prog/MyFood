# MyFood — Plataforma de delivery local

Projeto em desenvolvimento (código real, banco local persistente e API própria) que conecta **consumidores**, **estabelecimentos**, **entregadores** e **administradores**. PT-BR, BRL, endereços brasileiros, com suporte a múltiplas cidades via configuração.

> **Estado atual:** projeto em desenvolvimento, não pronto para produção. Pagamentos online, webhooks e estornos estão desativados por segurança; mapas, push, upload e outras integrações ainda não foram concluídos. Veja `docs/PRONTIDAO-INTEGRACOES.md` para bloqueios e próximos passos.

## Execução rápida (desenvolvimento)

```bash
node -v                 # >= 22.5 (usa node:sqlite nativo)
npm install
npm run seed            # cria admin + categorias (sem dados fictícios de loja)
npm run dev             # API em :4000 e site em :5173
```

Acesse `http://localhost:5173`. Administrador padrão do seed: `admin@myfood.local` / `Admin@12345` — **troque em produção** via `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

Para rodar o app móvel:
```bash
cd apps/mobile && npm install && npm start
# Configure EXPO_PUBLIC_API_URL com o IP da máquina na rede local.
```

Outros comandos:

```bash
npm test                # 21 testes (unitários + integração + fluxo completo)
npm run typecheck       # API, web e shared
npm run build:web       # bundle de produção do site/painéis
npm run build:api       # checagem de tipos da API
```

## Arquitetura (visão geral)

```
apps/api          Node 22 + TypeScript + Express + WebSocket + node:sqlite
apps/web          React + Vite + TypeScript + Tailwind (site e 3 painéis)
apps/mobile       Expo / React Native (consumidor e entregador)
packages/shared   Tipos, cálculo de carrinho/comissão e formatação PT-BR
docs              Arquitetura, API, pagamentos, deploy, segurança, mobile
infra             Dockerfile e exemplo de proxy reverso
data/             Banco SQLite persistente (criado em runtime; ignorado pelo Git)
```

Regras financeiras ficam no servidor (`packages/shared` + `apps/api/src/modules/orders/service.ts`), nunca nas telas. Comissão padrão: **8% sobre produtos elegíveis** e **8% sobre taxa de entrega**, com no máximo **um** lançamento de comissão por pedido (restrição `UNIQUE`). Restante da entrega é destinado ao entregador. Bases e alíquotas são configuráveis e auditadas.

## Funcionalidades implementadas

- **Consumidor:** cadastro/login, busca e filtros, categorias, favoritos, página da loja com horários/mapa/cardápio, produtos com grupos de opções e adicionais, carrinho com cálculo no servidor, cupom, endereços (ViaCEP), checkout, pedidos, acompanhamento com 9 estados + cancelamento/falha, avaliações, repetir pedido, chat por pedido, perfil LGPD.
- **Estabelecimento:** cadastro independente com aprovação, dashboard, pedidos em tempo real, aceitar/recusar/preparar/solicitar entregador, cardápio completo (produtos, opções, disponibilidade, ordem), configurações comerciais e horários, cupons, financeiro com comissões e repasses.
- **Entregador:** cadastro com aprovação, online/offline, solicitações geográficas, aceite atômico sem corrida, retirada/entrega, localização compartilhada somente durante a entrega, ganhos e histórico.
- **Admin:** dashboard com métricas e gráficos, aprovação/suspensão de lojas e entregadores, gestão de consumidores, pedidos, financeiro, registros de repasses, categorias, banners, comissões, cidades e logs de auditoria.
- **Plataforma:** RBAC, JWT, bcrypt, rate limiting, validação Zod, transações locais, testes de idempotência manual, WebSocket, notificações internas, LGPD e testes automatizados.

## Documentação

- `docs/ARCHITECTURE.md` — decisões técnicas e modelo de dados.
- `docs/API.md` — endpoints e contratos.
- `docs/PAYMENTS.md` — provedores, configuração e regras de idempotência/estorno.
- `docs/DEPLOYMENT.md` — produção, variáveis, domínio, builds e publicação.
- `docs/MOBILE.md` — Expo, EAS, build Android/iOS e envio às lojas.
- `docs/SECURITY.md` — RBAC, auditoria e LGPD.
- `docs/TESTING.md` — cenário obrigatório executado e resultados.
