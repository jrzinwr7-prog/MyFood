# Pagamentos — estado e pendências

Dinheiro e PIX manual ficam pendentes até confirmação explícita da loja responsável ou administrador. Esses fluxos foram testados localmente; a operação de PIX exige instruções reais e conferência fora do sistema.

**PIX automático, cartões, webhooks, estornos e split NÃO estão habilitados**, mesmo que `PAYMENTS_PROVIDER` ou credenciais sejam configurados. Os adaptadores em `apps/api/src/modules/payments/provider.ts` são código experimental, não testado contra o provedor; não representam uma integração pronta e não devem ser usados para cobranças reais.

Antes de habilitar: selecionar e contratar provedor, conferir documentação atual e contratos marketplace; implementar o onboarding de recebedores, split e repasses; corrigir e testar idempotência e concorrência para impedir cobranças duplicadas; validar eventos e assinaturas e obter o estado real junto ao provedor; implementar cancelamento, estornos e conciliação. Executar testes de sandbox e homologação, inclusive eventos fora de ordem, fraude e falhas de rede. Registrar e acompanhar auditoria financeira.

Não armazenar números de cartão ou credenciais no cliente; usar checkout/tokenização oficial do provedor e cumprir seus requisitos. Consulte `docs/PRONTIDAO-INTEGRACOES.md`.
