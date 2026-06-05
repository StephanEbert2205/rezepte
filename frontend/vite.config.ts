import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // Explizit einbinden
      includeAssets: [
        'favicon.ico',
        'logo.svg',
        'apple-touch-icon-180x180.png',
      ],

      // Web App Manifest
      manifest: {
        name: 'Rezeptsammlung',
        short_name: 'Rezepte',
        description: 'Deine persönliche Rezeptsammlung – Rezepte importieren, abfotografieren und teilen.',
        theme_color: '#ee7a1b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'de',
        icons: [
          { src: 'pwa-64x64.png',           sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',          sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',          sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],

        // Web Share Target API: App erscheint in der System-Teilen-Liste
        // Browser navigiert zu /import?url=<url>&title=<title>&text=<text>
        share_target: {
          action: '/import',
          method: 'GET',
          params: {
            title: 'title',
            text:  'text',   // Fallback: manche Apps schicken URL in "text"
            url:   'url',
          },
        },
      },

      // Workbox: App-Shell cachen
      workbox: {
        // Alle statischen Assets vorausladen
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // SPA-Navigation: Fallback auf index.html – AUSSER für /api/*
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // Google Fonts CSS → 1 Jahr cachen
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts Webfonts → 1 Jahr cachen
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // /api/* niemals cachen – immer ans Netzwerk durchreichen
          {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
