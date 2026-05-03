/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { env } from 'process';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: env['services__api__https__0'] || env['services__api__http__0'] || 'https://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    mkcert(),
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'osi Time Tracker',
        short_name: 'osiTime',
        description: 'Time tracking application',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: [/vue/],
      },
    },
  },
});
