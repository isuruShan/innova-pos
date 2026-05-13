import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_QR_ORDER_API || 'http://localhost:5010',
        changeOrigin: true,
      },
    },
  },
});
