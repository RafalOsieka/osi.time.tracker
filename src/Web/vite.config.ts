/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../osi.time.tracker.Api/wwwroot',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: [/vue/],
      },
    },
  },
})
