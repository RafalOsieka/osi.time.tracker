import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'dev-seed',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
