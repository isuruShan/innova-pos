import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pwaManifest = {
  name: 'Cafinity POS',
  short_name: 'POS',
  description: 'Cafinity point of sale',
  theme_color: '#0f172a',
  background_color: '#0f172a',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  start_url: '/',
  icons: [
    {
      src: 'cafinity-logo.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'cafinity-logo.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['cafinity-logo.png', 'favicon.svg', 'logo.png'],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'document',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
