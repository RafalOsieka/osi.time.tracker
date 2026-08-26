import { defineVitestProject } from '@nuxt/test-utils/config';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('.', import.meta.url)).replaceAll('\\', '/');
const appRoot = fileURLToPath(new URL('./app', import.meta.url)).replaceAll('\\', '/');

const nuxtAliases = {
  '~~/': `${repoRoot}/`,
  '~~': repoRoot,
  '~/': `${appRoot}/`,
  '~': appRoot,
};

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['app/**', 'server/**', 'shared/**'],
      exclude: [
        'test/**',
        '**/*.config.{ts,js,mjs,cjs}',
        '.nuxt/**',
        '.output/**',
        '**/*.d.ts',
        'server/db/migrations/**',
        '**/*.{sql,json}',
        'app/plugins/shared-chunk-warmup.ts',
      ],
    },
    projects: [
      {
        resolve: { alias: nuxtAliases },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'e2e-db',
          include: ['test/e2e/db/**/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/e2e/harness/global-setup-db.ts'],
          hookTimeout: 600_000,
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'e2e-api',
          include: ['test/e2e/api/**/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/e2e/harness/global-setup-server.ts'],
          hookTimeout: 600_000,
          testTimeout: 60_000,
          maxWorkers: Math.max(1, Math.min(4, Math.floor(cpus().length / 2))),
          // Allows describe.concurrent in a file; @nuxt/test-utils url() needs bindTestOrigin().
          maxConcurrency: 5,
        },
      },
      {
        test: {
          name: 'e2e-ui',
          include: ['test/e2e/ui/**/*.{test,spec}.ts'],
          environment: 'node',
          globalSetup: ['test/e2e/harness/global-setup-server.ts'],
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
          hookTimeout: 30_000,
        },
      }),
    ],
  },
});
