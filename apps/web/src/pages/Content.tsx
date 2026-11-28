import { Link } from 'react-router-dom';
import { ConsumerShell } from '../components/Layout';
import { Card } from '../components/ui';

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return <ConsumerShell><div className="mx-auto max-w-3xl"><h1 className="mb-5 text-3xl font-black">{title}</h1>
    <Card className="prose prose-sm max-w-none p-6 leading-relaxed text-ink/70 sm:p-9">{children}</Card>
    <p className="mt-4 text-xs text-ink/45">Última atualização: 26/11/2026 · Versão 1.0</p></div></ConsumerShell>;
}
export function Terms() { return <Doc title="Termos de uso">
  <h2 className="text-lg font-extrabold text-ink">1. Sobre a plataforma</h2><p>O FastDelivery é uma plataforma tecnológica que interpõe consumidores, estabelecimentos e entregadores. Não somos fabricantes dos produtos anunciados; cada estabelecimento é responsável pela procedência, preparo, higiene e veracidade das informações do cardápio.</p>
  <h2 className="text-lg font-extrabold text-ink">2. Cadastros e aprovação</h2><p>Consumidores podem se cadastrar livremente. Estabelecimentos e entregadores passam por análise e aprovação da administradora antes de operar. É proibido fornecer dados falsos ou documentos inválidos.</p>
  <h2 className="text-lg font-extrabold text-ink">3. Pedidos, preços e pagamentos</h2><p>Os preços são definidos pelos estabelecimentos. O valor final é calculado no servidor no momento da confirmação, incluindo adicionais, descontos e taxa de entrega. Pagamentos online dependem de provedor configurado; quando indisponíveis, o sistema oferece apenas modalidades pendentes de confirmação manual, sem afirmar pagamento aprovado.</p>
  <h2 className="text-lg font-extrabold text-ink">4. Comissões</h2><p>A plataforma cobra comissão padrão de 8% sobre o valor elegível dos produtos e 8% sobre a taxa de entrega, configurável pelo administrador. O repasse ao entregador corresponde ao restante da taxa de entrega, deduzida a comissão.</p>
  <h2 className="text-lg font-extrabold text-ink">5. Cancelamentos e estornos</h2><p>Cancelamentos seguem as regras exibidas no acompanhamento do pedido. Estornos são processados pelo provedor quando aplicável e registrados em histórico auditável.</p>
  <h2 className="text-lg font-extrabold text-ink">6. Uso adequado</h2><p>É vedado usar a plataforma para fraudes, assédio, discriminação, divulgação de conteúdo ilícito ou violação de direitos de terceiros. Violações podem levar à suspensão da conta.</p>
  <p className="mt-4">Dúvidas: <Link className="text-coral underline" to="/ajuda">central de ajuda</Link>.</p>
</Doc>; }
export function Privacy() { return <Doc title="Política de privacidade e LGPD">
  <p>O FastDelivery atua como controlador dos dados cadastrais e como operador de dados de pedidos conforme a Lei nº 13.709/2018 (LGPD).</p>
  <h2 className="text-lg font-extrabold text-ink">Dados coletados</h2><p>Nome, e-mail, telefone, endereços de entrega, documentos de estabelecimentos/entregadores, histórico de pedidos, mensagens, avaliações e registros de auditoria. Não armazenamos números completos de cartões: dados de pagamento são tokenizados pelo provedor.</p>
  <h2 className="text-lg font-extrabold text-ink">Finalidades</h2><p>Execução de pedidos, comunicação entre participantes, prevenção à fraude, cumprimento de obrigações legais, cálculo e repasse financeiro, suporte e melhoria da experiência.</p>
  <h2 className="text-lg font-extrabold text-ink">Compartilhamento</h2><p>Dados necessários são compartilhados com o estabelecimento e o entregador envolvidos no pedido. Endereços completos de consumidores não são exibidos publicamente. Localização em tempo real é compartilhada apenas durante a entrega e mediante ação explícita do entregador.</p>
  <h2 className="text-lg font-extrabold text-ink">Seus direitos</h2><p>Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, anonimização ou exclusão. No perfil é possível exportar seus dados e registrar solicitação de exclusão. O controlador responderá conforme prazos legais.</p>
  <h2 className="text-lg font-extrabold text-ink">Segurança e retenção</h2><p>Senhas são armazenadas com hash bcrypt, acesso é segmentado por perfil, rotas são protegidas e ações sensíveis geram logs de auditoria. Dados são retidos pelo tempo necessário às finalidades e obrigações fiscais.</p>
  <p className="mt-4">Solicitações: <Link className="text-coral underline" to="/perfil">área do perfil</Link>.</p>
</Doc>; }
export function Help() { return <Doc title="Central de ajuda">
  <p><Link className="font-bold text-coral underline" to="/suporte-ia">Conversar com o assistente virtual</Link></p>
  <h2 className="text-lg font-extrabold text-ink">Como faço um pedido?</h2><p>Escolha um estabelecimento, monte seu pedido, informe o endereço, selecione a forma de pagamento e confirme. Acompanhe cada etapa na tela do pedido.</p>
  <h2 className="text-lg font-extrabold text-ink">O que significa pagamento pendente?</h2><p>Quando não há provedor de pagamento online configurado, PIX manual e dinheiro na entrega ficam pendentes até o estabelecimento confirmar o recebimento. Nenhum valor é debitado automaticamente nesses modos.</p>
  <h2 className="text-lg font-extrabold text-ink">Como virar estabelecimento ou entregador?</h2><p>Use os links de cadastro na página inicial. Seu cadastro será analisado pelo administrador antes de começar a operar.</p>
  <h2 className="text-lg font-extrabold text-ink">Problemas com um pedido</h2><p>Use a conversa vinculada ao pedido ou abra um chamado em Perfil → Ajuda e LGPD.</p>
</Doc>; }
