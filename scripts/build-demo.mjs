import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
const env = { ...process.env, VITE_DEMO: 'true', VITE_BASE_PATH: '/MyFood/demo/', VITE_HASH_ROUTER: 'true', VITE_VISUAL_PREVIEW: 'false', VITE_TEMP_TEST: 'false', VITE_API_ORIGIN: '' };
const result = spawnSync('node_modules/.bin/vite', ['build', '--config', 'apps/web/vite.config.ts'], { env, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync('apps/web/dist-demo/imagens', { recursive: true });
cpSync('demo-temporaria/imagens', 'apps/web/dist-demo/imagens', { recursive: true });
