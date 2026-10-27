import type { RequestEvent } from 'nuxt/server';

/**
 * Route-protection helper for private/server endpoints.
 *
 * Wraps `requireUserSession` from nuxt-auth-utils: it resolves the current
 * session when authenticated and throws a 401 error (handled by Nitro) when no
 * valid session is present, so protected handlers never run unauthenticated.
 *
 * Usage:
 * ```ts
 * import { defineEventHandler } from 'nuxt/server';
 *
 * export default defineEventHandler(async (event) => {
 *   const { user } = await requireAuth(event);
 *   // ...handle the authenticated request for `user`
 * });
 * ```
 */
export async function requireAuth(event: RequestEvent) {
  return await requireUserSession(event);
}
