import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const OUTPUT_DIR = fileURLToPath(new URL('../../../.output', import.meta.url));
export const OUTPUT_ENTRY = fileURLToPath(
  new URL('../../../.output/server/index.mjs', import.meta.url),
);

export function needsNuxtBuild(kind = process.env.E2E_KIND): boolean {
  return kind !== 'db';
}

export function resolveProductionBuildAction({
  kind = process.env.E2E_KIND,
  isDev = Boolean(process.env.NUXT_TEST_DEV),
  skipBuild = Boolean(process.env.NUXT_TEST_SKIP_BUILD),
  outputExists,
}: {
  kind?: string;
  isDev?: boolean;
  skipBuild?: boolean;
  outputExists: boolean;
}): 'none' | 'build' | 'reuse' {
  if (!needsNuxtBuild(kind) || isDev) return 'none';
  if (skipBuild) {
    if (!outputExists) {
      throw new Error(
        `NUXT_TEST_SKIP_BUILD is set but ${OUTPUT_ENTRY} is missing. Restore the production .output artifact before running api/ui e2e.`,
      );
    }
    return 'reuse';
  }
  return 'build';
}

export function outputExists(): boolean {
  return existsSync(OUTPUT_ENTRY);
}
