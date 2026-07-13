/**
 * Rate limiting knobs for `/api/auth/login`, shared between `nuxt.config.ts`
 * (where the limit is actually enforced via `nuxt-security` route rules) and
 * the e2e test that asserts the throttling behavior (`test/e2e/auth.spec.ts`),
 * so the two never drift apart.
 *
 * The production limit stays deliberately tight (brute-force mitigation). The
 * e2e limit is much more generous: several e2e spec files legitimately log in
 * as multiple users many times per run without artificial delays between
 * calls, and a too-tight bucket causes CI-only flakiness (fast, back-to-back
 * requests exhaust the bucket, silently dropping the session cookie and
 * cascading into unrelated 401s/500s in unrelated tests).
 */
export const PROD_LOGIN_RATE_LIMIT = {
  tokensPerInterval: 5,
  interval: 60_000,
} as const;

export const E2E_LOGIN_RATE_LIMIT = {
  tokensPerInterval: 30,
  interval: 3_000,
} as const;
