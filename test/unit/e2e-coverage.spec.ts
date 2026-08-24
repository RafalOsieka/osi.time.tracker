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

  it('passes first-party include/exclude globs to c8 report', () => {
    const args = c8ReportArgs('coverage-v8-e2e', 'coverage-e2e-api');
    expect(args).toContain('--include');
    expect(args).toContain('app/**');
    expect(args).toContain('server/**');
    expect(args).toContain('shared/**');
    expect(args).toContain('--exclude');
    expect(args).toContain('server/db/migrations/**');
    expect(args).toContain('**/*.{sql,json}');
    expect(args).toContain('app/plugins/shared-chunk-warmup.ts');
  });
});
