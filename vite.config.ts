import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The site is deployed to GitHub Pages under /<repo>/bassx/.
 * Set VITE_BASE (e.g. "/Nova-Tweaks-official/bassx/") at build time,
 * or leave it unset for local dev / user-site hosting at the root.
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: 'BASSX — Bass Booster',
        short_name: 'BASSX',
        description:
          'A premium real-time bass booster, 18-band equalizer and audio visualizer for the web.',
        theme_color: '#050507',
        background_color: '#050507',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: base,
        start_url: base,
        id: base,
        categories: ['music', 'entertainment', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Splash screens and the 4 MB demo are intentionally not precached:
        // they are only needed on iOS launch / first playback. The demo is
        // runtime-cached after it is played, so it still works offline.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: /\/demo\/[^/]+\.wav$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bassx-demo-audio',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
    {
      // GitHub Pages has no SPA rewrite. Serving index.html as 404.html
      // lets deep links boot the client router.
      name: 'spa-404-fallback',
      closeBundle() {
        const dist = resolve(process.cwd(), 'dist')
        copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
      },
    },
  ],
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
