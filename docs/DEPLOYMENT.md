> Não implante para produção sem resolver os bloqueios descritos em `docs/PRONTIDAO-INTEGRACOES.md`.

# Implantação

## 1. Servidor

```bash
git clone <seu-repo> && cd MyFood
cp .env.example .env           # preencha JWT_SECRET, ADMIN_*, PAYMENTS_*, PUBLIC_ORIGIN
npm install
npm run build:web              # gera apps/web/dist
npm run seed                   # apenas na primeira execução
NODE_ENV=production npm run dev:api   # ou use o Dockerfile
```

O `Dockerfile` de exemplo instala dependências e expõe a API na porta 4000. Use um processo supervisor (systemd/PM2) ou containers orquestrados. O frontend estático pode ser servido por Nginx/CDN apontando para `apps/web/dist`; configure o proxy reverso de `/api` e `/ws` para a API (exemplo em `infra/nginx.conf`).

## 2. Banco de dados

- Desenvolvimento: `data/myfood.db` (SQLite WAL, criado automaticamente).
- Produção: **migrar para PostgreSQL** antes de tráfego relevante (o SQLite é single-writer). Exporte o schema, traduza placeholders e use Prisma Migrate. Faça backup diário com `pg_dump` ou snapshot equivalente e teste restauração.
- Nunca versionar o arquivo de banco (já ignorado pelo Git).

## 3. Domínio e TLS

1. DNS: `app.seu-dominio.com` (frontend) e `api.seu-dominio.com` (API).
2. TLS com Let's Encrypt no reverse proxy.
3. `PUBLIC_ORIGIN=https://app.seu-dominio.com`, `WEBHOOK_BASE_URL=https://api.seu-dominio.com`.
4. CORS já restringe à origem configurada.

## 4. Pagamentos

Siga `docs/PAYMENTS.md`. PIX manual e dinheiro ficam pendentes até confirmação. Pagamentos online, webhooks e estornos estão bloqueados mesmo com credenciais, até integração e homologação. Isso é uma decisão explícita de produto, não uma simulação.

## 5. Storage de imagens

Produtos/lojas aceitam URL pública. Configure S3/R2/Cloudinary + CDN e forneça URLs ao painel. Não há upload direto para o servidor nesta versão.

## 6. Notificações push

Notificações internas e WebSocket têm implementação local. Push web e mobile ainda precisam ser implementados e testados; as variáveis VAPID não o habilitam.

## 7. Mobile

Ver `docs/MOBILE.md`. É necessárioconta Expo/EAS e, para publicação, contas Google Play e Apple Developer (não incluídas).

## 8. Monitoramento

- Healthcheck: `GET /health`.
- Logs estruturados no stderr da API + `audit_logs` no banco.
- Recomendado: Sentry (erros), Uptime Kuma (disponibilidade), backups automáticos e alertas de disco.

## Prévia visual no GitHub Pages

O workflow `.github/workflows/pages.yml` publica uma **prévia visual**, sem API ou dados simulados. Ative em Settings → Pages → Build and deployment → Source: GitHub Actions, e execute o workflow “Publicar prévia visual” na branch de trabalho. O Pages precisa estar disponível para a visibilidade/plano do repositório; não altere a visibilidade sem autorização. A URL é informada pelo próprio GitHub no resultado do deploy.

A build usa `VITE_BASE_PATH=/MyFood/`, `VITE_HASH_ROUTER=true` e `VITE_VISUAL_PREVIEW=true`. O modo visual não envia requisições à API e informa que pedidos, contas e pagamentos estão indisponíveis. Para conectar uma API HTTPS posteriormente, desative o modo visual (`VITE_VISUAL_PREVIEW=false`), configure `VITE_API_ORIGIN` com a origem HTTPS pública da API, e configure `PUBLIC_ORIGIN` na API com a origem do Pages (sem caminho). O WebSocket usará a mesma origem da API. A API precisa de hospedagem e banco persistente próprios; Pages não os hospeda.
