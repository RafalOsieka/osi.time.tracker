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

/**
 * Guard that skips the suite if Docker is not available.
 * Usage: `const describeAuth = requireDocker();`
 */
export function requireDocker() {
  return isDockerAvailable() ? describe : describe.skip;
}

/**
 * Guard that skips the suite if either Docker or Browser is not available.
 * Usage: `const describeAuthUI = requireBrowser();`
 */
export function requireBrowser() {
  const browserAndDocker = isDockerAvailable() && isBrowserAvailable();
  return browserAndDocker ? describe : describe.skip;
}
