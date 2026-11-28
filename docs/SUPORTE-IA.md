# Assistente virtual de suporte

O assistente está disponível no site em `/suporte-ia`, com botão no site e acesso no app consumidor e entregador. A chamada à IA exige sessão autenticada e sempre passa pela API do servidor; a chave nunca é enviada ao navegador ou ao aplicativo. A conversa fica apenas no estado da interface durante a sessão da tela e é transmitida ao provedor a cada pergunta. Há um aviso ao usuário para não compartilhar dados sensíveis.

## Configuração no servidor

1. Crie `.env` (ignorado pelo Git) a partir de `.env.example` ou configure o segredo no painel de hospedagem, somente no servidor. Defina `OPENROUTER_API_KEY` com uma chave ativa. **Não use prefixos `VITE_` ou `EXPO_PUBLIC_` e nunca comite ou cole a chave no código.**
2. O servidor carrega `.env` usando dotenv; variáveis já configuradas no ambiente têm prioridade. Reinicie a API após mudar a configuração.
3. A chave deve permitir usar `nvidia/nemotron-3-ultra-550b-a55b:free`. Configure restrições/limites de uso no provedor; a disponibilidade, quotas e políticas do modelo podem mudar. A integração não faz fallback para modelos pagos.
4. Configure hospedagem HTTPS da API, banco, `PUBLIC_ORIGIN` e `VITE_API_ORIGIN` conforme `docs/DEPLOYMENT.md`. A build visual do GitHub Pages mantém `VITE_VISUAL_PREVIEW=true`: ela mostra a tela, mas bloqueia envio.

Rota: `POST /api/ai-support/chat`, com `Authorization: Bearer <token da sessão>` e JSON `{ "messages": [{ "role": "user", "content": "Como faço um pedido?" }] }`. A API aceita somente `user` e `assistant`, até 16 mensagens, 2.000 caracteres por mensagem e 12.000 no total. A última deve ser `user`. Acrescenta a memória fixa no servidor e envia ao OpenRouter por HTTPS, com timeout de 30 segundos. Retorna `{ "reply": "..." }` ou erro genérico; não retorna nem registra a chave ou resposta bruta de erro do provedor.

O limite local é 10 requisições por usuário por 10 minutos, na memória do processo, e não é distribuído nem persistente. Antes de produção, implemente limites robustos por usuário/IP, controle de gastos, proteção contra abuso, monitoramento, revisão de privacidade/LGPD e atendimento humano de contingência. A IA pode inventar respostas e instruções de sistema não garantem segurança; não confie nela para realizar ações sensíveis, autorizações ou decisões financeiras. Não tem acesso a dados reais dos pedidos. Rever a memória em `service.ts` quando as funcionalidades mudarem.

**Teste:** `npm test` usa respostas simuladas exclusivamente nos testes para verificar modelo, histórico, memória fixa, autenticação e erros. Não substitui homologação contra o provedor real. A rede deste ambiente não alcança OpenRouter, portanto nenhuma resposta real foi testada aqui.
