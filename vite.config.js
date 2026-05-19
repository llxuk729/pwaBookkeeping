import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pwaBookkeeping/', // Set base to repo name for GitHub Pages
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '智能记账',
        short_name: '记账',
        description: '语音输入、AI辅助的智能记账应用',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        scope: '/pwaBookkeeping/',
        start_url: '/pwaBookkeeping/',
        // Note: Web App Manifest doesn't support permissions field
        // Microphone permission must be requested via getUserMedia API at runtime
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          // iOS specific icons
          {
            src: 'icons/apple-touch-icon-180.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Exclude large model files from precaching, use runtime caching instead
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Include model config files but exclude large .onnx files
        globIgnores: ['**/models/**/onnx/*.onnx'],
        runtimeCaching: [
          // Cache local Whisper model files (large files)
          {
            urlPattern: /\/models\/.*\.onnx$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-model-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache model config files
          {
            urlPattern: /\/models\/.*\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-config-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Google fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
})
