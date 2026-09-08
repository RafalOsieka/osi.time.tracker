import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
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
