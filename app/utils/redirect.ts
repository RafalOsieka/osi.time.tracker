/**
 * Pure, framework-agnostic sanitizer for the `?redirect` query value.
 *
 * Accepts only same-origin relative paths: the value MUST start with a single
 * `/` (not `//`, which is protocol-relative, nor an absolute URL such as
 * `https://evil.com`). Anything else is rejected and the caller-provided
 * fallback (defaulting to `/`) is returned instead, preventing open redirects.
 *
 * Shared by the global navigation guard and the login page; kept free of
 * Vue/Nuxt so it can be unit tested in isolation (see `test/unit/redirect.spec.ts`).
 */
export function sanitizeRedirect(redirect: unknown, fallback = '/'): string {
  if (typeof redirect !== 'string') {
    return fallback;
  }
  // Must be a path starting with exactly one `/`.
  if (!redirect.startsWith('/') || redirect.startsWith('//')) {
    return fallback;
  }
  // Reject backslash tricks that some browsers treat as protocol-relative.
  if (redirect.startsWith('/\\')) {
    return fallback;
  }
  return redirect;
}
