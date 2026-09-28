import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    name: 'remote-trackers',
    include: ['test/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
