import type { H3Event } from 'h3';

/**
 * Route-protection helper for private/server endpoints.
 *
 * Wraps `requireUserSession` from nuxt-auth-utils: it resolves the current
 * session when authenticated and throws a 401 error (handled by Nitro) when no
 * valid session is present, so protected handlers never run unauthenticated.
 *
 * Usage:
 * ```ts
 * export default defineEventHandler(async (event) => {
 *   const { user } = await requireAuth(event);
 *   // ...handle the authenticated request for `user`
 * });
 * ```
 */
export async function requireAuth(event: H3Event) {
  return await requireUserSession(event);
}
