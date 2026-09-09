import { existsSync } from 'node:fs';
import { describe } from 'vitest';
import { chromium } from 'playwright';

export function isCi(): boolean {
  return Boolean(process.env.GITHUB_ACTIONS);
}

export function isChromiumAvailable(): boolean {
  try {
    const executablePath = chromium.executablePath();
    return Boolean(executablePath) && existsSync(executablePath);
  } catch {
    return false;
  }
}

/** Skip locally when bundled Chromium is missing; fail in CI. */
export function requireChromium() {
  if (isChromiumAvailable()) return describe;
  if (isCi()) {
    throw new Error('Bundled Chromium is required in CI for extension browser tests');
  }
  return describe.skip;
}
