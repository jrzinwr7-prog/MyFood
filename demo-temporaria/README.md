# Demonstração temporária

Este diretório contém exclusivamente dados e imagens fictícios para uma segunda compilação da interface existente. `npm run build:demo` cria `apps/web/dist-demo`, com base `/MyFood/demo/` para GitHub Pages. O workflow publica essa compilação em `/demo/` sem alterar a aplicação normal.

O modo demo usa `demoRequest` local, conta e endereço fictícios e uma chave própria de armazenamento do carrinho. Não faz chamadas à API, não usa credenciais, não cria pedidos e bloqueia o pagamento. As opções e preços são fictícios. As imagens foram geradas por IA. Para remover, exclua este diretório, as integrações `DEMO_MODE` e o passo de build no workflow.
