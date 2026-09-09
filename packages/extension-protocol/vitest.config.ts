import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'extension-protocol',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
