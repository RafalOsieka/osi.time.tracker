import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    name: 'extension-protocol',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
