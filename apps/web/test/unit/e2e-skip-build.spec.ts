import { describe, expect, it } from 'vitest';
import { resolveProductionBuildAction } from '../e2e/harness/skip-build';

describe('e2e skip-build', () => {
  it('does not build for the db kind', () => {
    expect(
      resolveProductionBuildAction({
        kind: 'db',
        isDev: false,
        skipBuild: false,
        outputExists: false,
      }),
    ).toBe('none');
  });

  it('does not build in NUXT_TEST_DEV', () => {
    expect(
      resolveProductionBuildAction({
        kind: 'server',
        isDev: true,
        skipBuild: false,
        outputExists: false,
      }),
    ).toBe('none');
  });

  it('reuses .output when skip-build is set and the artifact exists', () => {
    expect(
      resolveProductionBuildAction({
        kind: 'server',
        isDev: false,
        skipBuild: true,
        outputExists: true,
      }),
    ).toBe('reuse');
  });

  it('fails when skip-build is set and .output is missing', () => {
    expect(() =>
      resolveProductionBuildAction({
        kind: 'server',
        isDev: false,
        skipBuild: true,
        outputExists: false,
      }),
    ).toThrow(/NUXT_TEST_SKIP_BUILD is set but /);
  });

  it('builds when skip-build is unset', () => {
    expect(
      resolveProductionBuildAction({
        kind: 'server',
        isDev: false,
        skipBuild: false,
        outputExists: false,
      }),
    ).toBe('build');
  });
});
