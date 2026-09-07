import { describe, expect, it } from 'vitest';
import { c8ReportArgs, lcovHasFirstPartySources } from '../e2e/harness/e2e-coverage';

describe('e2e-api coverage conversion', () => {
  it('accepts lcov that maps to first-party server/app/shared sources', () => {
    expect(
      lcovHasFirstPartySources(
        'SF:E:\\osieka.dev\\osi.time.tracker\\server\\api\\auth\\login.post.ts\n',
      ),
    ).toBe(true);
    expect(lcovHasFirstPartySources('SF:/repo/app/pages/index.vue\n')).toBe(true);
    expect(lcovHasFirstPartySources('SF:/repo/shared/utils/rounding.ts\n')).toBe(true);
  });

  it('rejects lcov that only names bundled .output chunks', () => {
    expect(lcovHasFirstPartySources('SF:.output/server/chunks/nitro.mjs\n')).toBe(false);
    expect(lcovHasFirstPartySources('SF:/repo/.output/server/index.mjs\n')).toBe(false);
  });

  it('does not pass Vitest include/exclude globs to c8 report', () => {
    const args = c8ReportArgs('coverage-v8-e2e', 'coverage-e2e-api');
    expect(args).toEqual([
      'report',
      '--temp-directory',
      'coverage-v8-e2e',
      '--reporter',
      'lcov',
      '--reports-dir',
      'coverage-e2e-api',
    ]);
    expect(args).not.toContain('--include');
    expect(args).not.toContain('--exclude');
  });
});
