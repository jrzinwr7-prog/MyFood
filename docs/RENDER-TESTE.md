# Render gratuito — teste temporário

Este ambiente é para testar suporte IA, não é produção. O SQLite fica em `/tmp` no serviço gratuito; dados de cadastro e conversas podem ser perdidos em reinicializações ou deploys. Ele pode adormecer e demorar ao acordar. Não insira dados pessoais reais, nem faça pedidos ou pagamentos reais. Não executar seed com senha de desenvolvimento; será necessário criar uma conta de teste de consumidor depois que o site estiver conectado.

`render.yaml` descreve o serviço Node, usa branch de trabalho e solicita `OPENROUTER_API_KEY` como segredo. Não registre a chave em git, nem a cole em chat. A `JWT_SECRET` é gerada pelo Render. A chave exposta em conversa deve ser revogada e substituída por uma nova.

Se criar Web Service manualmente: repositório `jrzinwr7-prog/MyFood`, branch `arena/f200c915-myfood`, runtime Node, plano Free, build `npm ci --include=dev`, start `npm run start:api`, healthcheck `/health`. Variáveis `NODE_VERSION=22.22.3`, `NODE_ENV=production`, `DATABASE_PATH=/tmp/myfood-test.db`, `PUBLIC_ORIGIN=https://jrzinwr7-prog.github.io`, `JWT_SECRET` forte gerado na plataforma e `OPENROUTER_API_KEY` preenchida em segredo no painel. Não expor nenhuma delas no código do site; os valores secretos não são necessários para configurar GitHub Pages.

Após o Render informar a URL HTTPS pública (sem segredos), confira `https://HOST/health`. A build Pages atual permanece no modo visual. Alguém com acesso ao projeto precisa configurar `VITE_API_ORIGIN=https://HOST` (sem barra final), `VITE_VISUAL_PREVIEW=false`, manter `VITE_BASE_PATH=/MyFood/` e `VITE_HASH_ROUTER=true`, republicar e validar CORS e login. Testar o modelo real com limite de gasto e restrições adequados no OpenRouter; API free pode sofrer indisponibilidade e limitações.
