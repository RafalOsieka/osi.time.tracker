import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'remote-trackers',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
