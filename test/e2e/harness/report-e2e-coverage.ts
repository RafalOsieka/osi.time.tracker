import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

/** Converts Nitro NODE_V8_COVERAGE JSON dumps to lcov. Not used by pnpm test:coverage. */

const v8Dir = process.env.NODE_V8_COVERAGE ?? 'coverage-v8-e2e';
const lcovPath = join('coverage-e2e-api', 'lcov.info');

function hasV8Dump(dir: string): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => name.endsWith('.json'));
}

function lcovHasFirstPartySources(contents: string): boolean {
  return /SF:.*[/\\](server|app|shared)[/\\]/.test(contents);
}

if (!hasV8Dump(v8Dir)) {
  throw new Error(
    `No V8 coverage dumps found in ${v8Dir}. Pass NODE_V8_COVERAGE through the Nitro process and re-run api e2e.`,
  );
}

execSync(
  `pnpm exec c8 report --temp-directory ${v8Dir} --reporter lcov --reports-dir coverage-e2e-api`,
  { stdio: 'inherit' },
);

if (!existsSync(lcovPath)) {
  throw new Error(`c8 did not write ${lcovPath}`);
}

const lcov = readFileSync(lcovPath, 'utf8');
if (!lcovHasFirstPartySources(lcov)) {
  throw new Error(
    `e2e-api lcov has no first-party app/server/shared paths (only bundled output). Refusing to upload.`,
  );
}

console.log(`Wrote first-party e2e-api coverage to ${lcovPath}`);
