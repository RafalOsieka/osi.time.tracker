/**
 * Nitro `c8 report` args. Do not pass Vitest include/exclude globs: c8 filters
 * compiled `.output` chunks *before* sourcemap remap, so `app/**` / `server/**`
 * / `.output/**` would drop the dump instead of the remapped sources.
 */

export function lcovHasFirstPartySources(contents: string): boolean {
  return contents.split(/\r?\n/).some((line) => {
    if (!line.startsWith('SF:')) return false;
    const filePath = line.slice(3).replace(/\\/g, '/');
    if (filePath.includes('.output/')) return false;
    return /(?:^|\/)(app|server|shared)\//.test(filePath);
  });
}

export function c8ReportArgs(v8Dir: string, reportsDir: string): string[] {
  return ['report', '--temp-directory', v8Dir, '--reporter', 'lcov', '--reports-dir', reportsDir];
}
