import { url as nuxtUrl } from '@nuxt/test-utils/e2e';

/** Captured so later `url()` calls work outside Nuxt test-utils ALS. */
let boundOrigin = '';

/** Capture the booted server origin so later `url()` calls work outside ALS. */
export function bindTestOrigin(): void {
  boundOrigin = nuxtUrl('').replace(/\/$/, '');
}

export function url(path: string): string {
  if (!boundOrigin) {
    return nuxtUrl(path);
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${boundOrigin}${suffix}`;
}
