# Segurança e LGPD

## Controles implementados

- Senhas com bcrypt (custo 12); JWT HS256 com expiração; sessão invalidada no logout do cliente.
- RBAC: `consumer`, `merchant`, `courier`, `admin`. Rotas protegidas por middleware; admins não podem ser criados via cadastro público.
- Escopo por estabelecimento: rotas de merchant usam `owner_id` da sessão; produtos e pedidos de outras lojas retornam 404.
- Entregador vê apenas dados do próprio cadastro e repasses próprios.
- Validação Zod em toda entrada; SQL parametrizado; escape de HTML pelo React; Docker/nginx com headers de segurança.
- Rate limit geral por IP (600/15 min) e bloqueio de login após 5 falhas (15 min).
- Webhooks com verificação HMAC antes de processar; idempotência por evento e por pagamento.
- `audit_logs` registra aprovações, suspensões, alterações financeiras, estornos, exportação LGPD e ações administrativas.
- LGPD: consentimento no cadastro, exportação de dados, solicitação de exclusão, política de privacidade e suporte.

## Boas práticas para produção

- Trocar `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` antes do primeiro deploy.
- Rodar API atrás de HTTPS; limitar acesso ao banco; backups criptografados.
- Revisar logs e auditoria periodicamente; aplicar patch do Node; monitorar tentativas de login.
- Em PostgreSQL, criar usuário com privilégios mínimos e RLS se necessário.
- Nunca expor `data/myfood.db`, `.env` ou chaves de provedor.

## Dados sensíveis

Números de cartão não são armazenados. Localização do consumidor não é pública; coordenadas são enviadas ao entregador apenas durante a entrega ativa. Endereços completos não aparecem em listagens públicas.
