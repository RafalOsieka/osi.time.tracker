import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'anti-slop',
          include: ['test/unit/anti-slop/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
