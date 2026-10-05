import { defineConfig } from 'vite-plus';
import ui from '@nuxt/ui/vite';
import vue from '@vitejs/plugin-vue';
import { nuxtUiOptions } from './nuxt-ui.options.js';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue(), ui(nuxtUiOptions)],
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser/**/*.{test,spec}.ts'],
          environment: 'node',
          hookTimeout: 60_000,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
