import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe } from 'vitest';
import { chromium } from 'playwright-core';

/**
 * Returns true when a usable Docker CLI is available on the host.
 */
export function isDockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when a browser binary is available locally.
 */
export function isBrowserAvailable(): boolean {
  try {
    const path = chromium.executablePath();
    return Boolean(path) && existsSync(path);
  } catch {
    return false;
  }
}

export function isCi(): boolean {
  return Boolean(process.env.CI);
}

/** Minimal suite function the skip-guard needs — real Vitest `describe` or a unit fake. */
export type DescribeSelection = {
  (name: string, fn: () => void): void;
  skip: (name: string, fn: () => void) => void;
};

/**
 * Selects `describe` or `describe.skip`, or throws in CI when a prerequisite is missing.
 */
export function describeOrSkip({
  available,
  missing,
  isCiEnv = isCi(),
  describeFn = describe,
}: {
  available: boolean;
  missing: string;
  isCiEnv?: boolean;
  describeFn?: DescribeSelection;
}): (name: string, fn: () => void) => void {
  if (available) return describeFn;
  if (isCiEnv) {
    throw new Error(`${missing} is required in CI (skipping is only allowed locally)`);
  }
  return describeFn.skip;
}

/**
 * Guard that skips the suite if Docker is not available (fails in CI).
 * Usage: `const describeAuth = requireDocker();`
 */
export function requireDocker() {
  return describeOrSkip({
    available: isDockerAvailable(),
    missing: 'Docker',
  });
}

/**
 * Guard that skips the suite if either Docker or Browser is not available (fails in CI).
 * Usage: `const describeAuthUI = requireBrowser();`
 */
export function requireBrowser() {
  const dockerAvailable = isDockerAvailable();
  return describeOrSkip({
    available: dockerAvailable && isBrowserAvailable(),
    missing: dockerAvailable ? 'Chromium' : 'Docker',
  });
}
