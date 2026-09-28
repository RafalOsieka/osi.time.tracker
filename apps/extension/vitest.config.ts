import { defineConfig } from 'vite-plus';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue()],
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
