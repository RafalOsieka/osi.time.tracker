import { url as nuxtUrl } from '@nuxt/test-utils/e2e';

const ORIGIN_KEY = '__osiE2eOrigin';

type OriginBag = typeof globalThis & { [ORIGIN_KEY]?: string };

function originBag(): OriginBag {
  // SAFETY: Test fixture asserts a typed boundary the compiler cannot prove.
  return globalThis as OriginBag;
}

function readOrigin(): string {
  return originBag()[ORIGIN_KEY] ?? '';
}

/** Capture the booted server origin so later `url()` calls work outside ALS. */
export function bindTestOrigin(): void {
  originBag()[ORIGIN_KEY] = nuxtUrl('').replace(/\/$/, '');
}

export function url(path: string): string {
  const origin = readOrigin();
  if (!origin) {
    return nuxtUrl(path);
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
}
