# Auditoria de interface — FastDelivery

Avaliação estática do código e dos padrões de interface (não é uma inspeção visual em todos os aparelhos). Classificação é uma avaliação de acabamento, não uma certificação. A lista separa ajustes efetuados de trabalho ainda necessário.

| Área | Avaliação inicial | Alteração nesta revisão | Pendências de validação |
| --- | --- | --- | --- |
| Início web / categorias | Amador: emojis como ícones e categorias inconsistentes | Ícones vetoriais coerentes, estados selecionados mantidos | Revisar contraste e corte em telas reais |
| Loja e cardápio web | Amador: foto genérica atribuída à loja, emojis e nomes técnicos de categorias | Placeholders neutros, ícones e nomes de categorias retornados pela API | Testar imagens reais e opções no aparelho |
| Carrinho e checkout web | Inconsistente: ícones decorativos e preços incorretos de adicionais no carrinho | Ícones, rótulos acessíveis, preço-base e adicionais separados, retorno à loja pelo slug | Teste visual e teclado completo do checkout |
| Pedidos e acompanhamento web | Inconsistente: navegação quebrada em Pages e estrelas sem rótulo | Navegação via roteador, controles de avaliação acessíveis | Teste visual de todos os estados |
| Conversas, perfil, suporte e autenticação web | Necessita refinamento: densidade e componentes divergentes | Melhoria de botões, cartões, campos, estados vazios e diálogos compartilhados | Revisão individual de cada estado e responsividade; suporte mantém emojis conversacionais solicitados |
| Portal da loja: painel, pedidos, cardápio, financeiro e configurações | Necessita refinamento: hierarquia, navegação e superfícies genéricas | Estilo comum de cartões, campos, botões, menu e diálogos; substituição de emoji no cardápio | Revisar tabelas, formulários longos e erros por tela |
| Entregador web: cadastro, painel, solicitações, entregas e ganhos | Necessita refinamento: hierarquia e superfícies genéricas | Componentes e navegação de painel compartilhados | Validar rotas, atualização e layout em telas pequenas |
| Administração web: acesso, painel, lojas, entregadores, usuários, pedidos, financeiro, configurações e suporte | Necessita refinamento: hierarquia e densidade de tabelas | Componentes, menu, títulos e superfícies compartilhados; tom visual faltante dos indicadores corrigido | Revisar cada tabela, formulário e estado vazio com dados reais de teste |
| App consumidor: acesso, início, loja, carrinho, pedidos, chat e perfil | Amador: emojis como ícones e botão secundário sem contraste | Ícones vetoriais, cor correta nos botões secundários, preço de adicionais corrigido | Testar cada tela com Android/iOS, leitor de tela e diferentes tamanhos |
| App entregador: painel, solicitações, entregas, ganhos e suporte | Amador: emojis em navegação/status | Ícones vetoriais e status visual com texto | Testar densidade da barra e ações em aparelhos reais |
| Animações e acessibilidade | Necessita validação | Movimento reduzido, foco visível e gerenciamento básico de foco nos diálogos web | Auditoria WCAG completa, teclado, leitor de tela, contraste, zoom e sobreposições |

Carrinhos web antigos deixaram de ser reutilizados porque podiam conter totais de adicionais incorretos; o usuário deve recriar o carrinho. O servidor recalcula o pedido e continua sendo a fonte de verdade. O ambiente publicado é temporário e não deve receber dados, pedidos ou pagamentos reais. Esta revisão não significa que todas as telas foram redesenhadas individualmente ou validadas em dispositivos.
