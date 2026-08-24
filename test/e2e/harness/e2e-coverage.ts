/** Shared first-party coverage globs for Vitest v8 and Nitro `c8 report`. */

export const COVERAGE_INCLUDE = ['app/**', 'server/**', 'shared/**'] as const;

export const COVERAGE_EXCLUDE = [
  'test/**',
  '**/*.config.{ts,js,mjs,cjs}',
  '.nuxt/**',
  '.output/**',
  '**/*.d.ts',
  'server/db/migrations/**',
  '**/*.{sql,json}',
  'app/plugins/shared-chunk-warmup.ts',
] as const;

export function lcovHasFirstPartySources(contents: string): boolean {
  return contents.split(/\r?\n/).some((line) => {
    if (!line.startsWith('SF:')) return false;
    const filePath = line.slice(3).replace(/\\/g, '/');
    if (filePath.includes('.output/')) return false;
    return /(?:^|\/)(app|server|shared)\//.test(filePath);
  });
}

export function c8ReportArgs(v8Dir: string, reportsDir: string): string[] {
  return [
    'report',
    '--temp-directory',
    v8Dir,
    '--reporter',
    'lcov',
    '--reports-dir',
    reportsDir,
    ...COVERAGE_INCLUDE.flatMap((glob) => ['--include', glob]),
    ...COVERAGE_EXCLUDE.flatMap((glob) => ['--exclude', glob]),
  ];
}
