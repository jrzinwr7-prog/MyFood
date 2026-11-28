# Estado real e roteiro de integração

Atualização: este projeto ainda NÃO é um produto pronto para produção. As integrações externas não podem ser consideradas prontas apenas com chaves. Não há cobranças reais ou contas externas criadas nesta revisão.

## Pronto nesta etapa
- Configuração de origem para API externa no site (`VITE_API_ORIGIN`) e modo visual seguro no GitHub Pages; o app móvel usa `EXPO_PUBLIC_API_URL`.
- CEP por ViaCEP; sem dados de exemplo em caso de erro. A disponibilidade da rede deve ser validada em produção.
- Pedidos e pagamentos manuais (dinheiro/PIX) testados localmente; confirmação depende do estabelecimento autorizado. Admin e loja têm segregação testada.
- Pagamentos online, webhooks e estornos desativados: o código dos provedores é experimental, não validado e não deve ser ligado diretamente.
- Servidor rejeita JWT fraco em produção; seed exige administrador definido e senha forte. O seed padrão é APENAS para desenvolvimento e não deve ser exposto.
- 21 testes locais e typechecks de API, site e app, além de build web. Testes não garantem segurança ou conformidade completos.

## Pendências bloqueantes para operar
1. **Pagamentos:** escolher provedor; revisar API, tokenização, contratos, status consultado no servidor, assinatura e IDs de webhook; garantir transações idempotentes e concorrência antes de fazer cobranças; implementar reembolso, cancelamento, split para todas as partes e conciliação. Testar sandbox e validar com o provedor antes da produção. Variáveis de ambiente sozinhas NÃO habilitam o fluxo.
2. **Banco:** persistência e backup comprovados; migração PostgreSQL antes de escalar e revisão da concorrência. A base usa node:sqlite síncrono; PostgreSQL não foi implementado.
3. **Mapas/entrega:** `GEOCODING_URL` e chave são apenas configuração reservada, NÃO há geocodificação integrada. Implementar o provedor, geocodificar endereços, não aceitar pedidos fora da área e tratar coordenadas ausentes; hoje a verificação de raio só ocorre quando existem coordenadas.
4. **Push:** não existe entrega de push por VAPID/FCM/APNs; implementar registro de dispositivos, consentimento, envio seguro, tokens expirados e testes em aparelhos. Há notificações internas e WebSocket.
5. **Imagens:** hoje aceita URLs; implementar upload autenticado para armazenamento, validação, limites, antivírus e autorização.
6. **Autenticação:** revisão de revogação de sessões, armazenamento de tokens no mobile, recuperação de senha/e-mail, rate limit distribuído, segurança WebSocket e segregação entre usuários; auditar dependências e permissões.
7. **Produção:** TLS, CORS, proxy, segredos, migrações, backups testados, monitoramento, alertas e política de dados/LGPD revisados; retirar contas e senha de desenvolvimento. Implantação real e resiliência não validadas.
8. **Aplicativos:** EAS e identificadores únicos, builds instaláveis, permissões, testes reais em Android/iOS, políticas das lojas e publicação. As exportações Hermes não substituem builds instaláveis.
9. **Finanças e regras:** revisão legal, fiscal e de contratos; testar juros, cancelamentos, descontos, arredondamento, repasses e auditoria de ponta a ponta; verificar regras de entrega e localidades.

## Credenciais
Não salvar chaves em Git, app cliente, imagens ou conversas. A API usa segredos no ambiente do servidor. Restrinja origens e chaves, e configure webhook HTTPS só depois da implementação verificada. `VITE_API_ORIGIN` e `EXPO_PUBLIC_API_URL` são URLs públicas, nunca segredos.

## Cancelamento, cidade e localização — revisão

- Criação do pedido exige cidade e UF declaradas iguais às da loja, comparadas sem acentos e diferenças de maiúsculas. **Isso não comprova que CEP, endereço ou coordenadas sejam autênticos.** ViaCEP e geocodificação confiáveis ainda precisam ser integrados ao fluxo de validação; o raio só é conferido quando há coordenadas.
- Cancelar um pedido antes da retirada cancela a entrega associada e notifica os participantes conectados. O cliente não consegue cancelar depois da retirada pelo fluxo atual. Um pagamento já confirmado permanece confirmado e cria solicitação de estorno pendente; nenhum dinheiro é automaticamente devolvido. Não há remuneração automática de entregador em caso de cancelamento. Motivo, corte, indenização, devolução, penalidades e mediação precisam de política comercial/jurídica e implementação adicional.
- O aplicativo do entregador e o painel web pedem localização real do dispositivo ao entrar online ou ao compartilhar manualmente durante uma entrega. A permissão de localização pode ser recusada, e então o usuário recebe erro sem substituição por coordenadas fictícias. Não há rastreamento contínuo ou em segundo plano nem GPS próprio dentro do app.
- Após o aceite, botões de retirada e entrega abrem navegação no Google Maps com o endereço; o endereço é enviado ao Google ao usar os botões. A precisão depende de endereço real e validação. Não é mapa integrado, nem teste em dispositivos reais. Na oferta, somente bairro e cidade de destino são exibidos antes do aceite; o valor exibido é taxa bruta, não necessariamente ganho líquido. A localização em linha reta não é rota de trânsito.
- Notificações internas/WebSocket não equivalem a push: app fechado, perda de rede e entregadores offline precisam de estratégia adicional. Verificar elegibilidade geográfica de ofertas, registro de destinatários e bloqueio de ofertas alheias, controle de concorrência e atualização no frontend antes de usar comercialmente.
