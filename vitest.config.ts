import { defineVitestProject } from '@nuxt/test-utils/config';
import { cpus } from 'node:os';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/e2e/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/e2e/support/global-setup.ts'],
          hookTimeout: 600_000,
          testTimeout: 60_000,
          maxWorkers: Math.max(1, Math.min(4, Math.floor(cpus().length / 2))),
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/*.{test,spec}.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
});
