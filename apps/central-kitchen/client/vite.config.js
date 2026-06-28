import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: /.*\/api\/axios$/,
        replacement: path.resolve(__dirname, 'src/api/axios.js'),
      },
      {
        find: /.*\/AuthContext$/,
        replacement: path.resolve(__dirname, 'src/context/AuthContext.jsx'),
      },
      {
        find: /.*\/StoreContext$/,
        replacement: path.resolve(__dirname, 'src/context/StoreContext.jsx'),
      },
    ],
  },
  server: {
    port: 5185,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5005',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (err, _req, res) => {
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  message:
                    'Central Kitchen API is not running. Start it with: pnpm --filter @central-kitchen/server dev on port 5005.',
                }),
              );
            }
            console.warn('[vite proxy] central kitchen API unavailable (127.0.0.1:5005):', err.message);
          });
        },
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
