import { url as nuxtUrl } from '@nuxt/test-utils/e2e';

const ORIGIN_KEY = '__osiE2eOrigin';

function readOrigin(): string {
  const value = (globalThis as Record<string, unknown>)[ORIGIN_KEY];
  return typeof value === 'string' ? value : '';
}

/** Capture the booted server origin so later `url()` calls work outside ALS. */
export function bindTestOrigin(): void {
  (globalThis as Record<string, unknown>)[ORIGIN_KEY] = nuxtUrl('').replace(/\/$/, '');
}

export function url(path: string): string {
  const origin = readOrigin();
  if (!origin) {
    return nuxtUrl(path);
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
}
