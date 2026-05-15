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
  // Chrome requires at least one 192px and one 512px icon to show the install prompt.
  icons: [
    {
      src: 'logo-1.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'logo-1.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'logo-1.png',
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
      includeAssets: ['logo-1.png', 'favicon.svg'],
      manifest: pwaManifest,
      // Enable service worker in dev so PWA features are testable locally.
      devOptions: {
        enabled: true,
        type: 'module',
      },
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
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 0,
      },
    },
  },
})
