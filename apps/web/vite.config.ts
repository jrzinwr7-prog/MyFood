import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    host: '0.0.0.0', port: 5173, allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:4000', ws: true },
    },
  },
  build: { outDir: 'dist' },
});
