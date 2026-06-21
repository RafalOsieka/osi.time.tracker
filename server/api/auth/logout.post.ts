/**
 * Logout endpoint.
 *
 * Clears the session cookie via `clearUserSession`, immediately invalidating
 * the session so subsequent requests are unauthenticated.
 */
export default defineEventHandler(async (event) => {
  await clearUserSession(event);
  return { loggedIn: false };
});
