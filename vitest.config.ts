import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'anti-slop',
          include: ['tools/oxlint/anti-slop/test/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
