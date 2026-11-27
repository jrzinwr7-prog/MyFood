# Testes

```bash
npm test
```

Executa `apps/api/tests/flow.test.ts` com banco SQLite temporário isolado (sem tocar em `data/myfood.db`).

## Resultado da última execução

`19 tests, 19 pass, 0 fail` (Node test runner).

## Cobertura

1. Cálculo de comissão 8%/8% (R$100 + R$10 → R$8,80 plataforma, R$9,20 entregador).
2. Carrinho: subtotal, adicionais, desconto e entrega.
3. Login administrativo e RBAC (consumidor e entregador negados em rotas admin/merchant).
4. Cadastro de estabelecimento como pendente; aprovação administrativa.
5. Produto de R$30 com grupos de opções (Duplo +R$5, Bacon +R$4), preço recalculado no servidor: 2×(3000+500+400) + 1000 entrega = R$88,00.
6. Consumidor cria conta e endereço; busca e página da loja.
7. Pedido criado com opções; pagamento `pix_manual` fica pendente e idempotente.
8. Loja recebe pedido, confirma pagamento manual, aceita, prepara e marca pronto.
9. Entregador cadastra, é aprovado, fica online, recebe oferta e aceita atomicamente (segundo aceite é rejeitado).
10. Consumidor acompanha os estados até entrega (retirado → a caminho → entregue).
11. Comissão gravada uma única vez, com repasses corretos (R$624 produtos + R$80 entrega = R$704 plataforma; R$7.176 para a loja; R$9,20 ao entregador).
12. Chat vinculado ao pedido e notificações.
13. Avaliação, webhook com assinatura inválida rejeitado e verificação dos painéis.

## Limitações de teste

Não há testes de UI automatizados (Playwright) nesta entrega. Os bundles web e mobile foram compilados e a API foi validada por integração HTTP. Testes de providers reais exigem contas sandbox — não executados sem credenciais.
