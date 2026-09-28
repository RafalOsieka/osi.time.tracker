import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    name: 'dev-seed',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
