import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './core/config.js';
import { initRealtime } from './realtime/index.js';

const app = createApp();
const server = createServer(app);
initRealtime(server);
server.listen(config.port, '0.0.0.0', () => {
  console.log(`MyFood API pronta em http://0.0.0.0:${config.port} (base de dados: ${config.dbPath})`);
  if (config.payments.provider === 'none')
    console.warn('[PAGAMENTOS] Nenhum provedor configurado: apenas PIX manual e dinheiro na entrega, sempre pendentes de confirmação.');
  if (config.jwtSecret.startsWith('development-only'))
    console.warn('[SEGURANÇA] Defina JWT_SECRET em produção.');
});
