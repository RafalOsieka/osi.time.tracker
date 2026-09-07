/**
 * Sample protected endpoint.
 *
 * Demonstrates and verifies route protection: unauthenticated requests are
 * rejected with HTTP 401 (via `requireAuth`), while authenticated requests
 * receive a payload scoped to the current session user.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event);
  return {
    message: 'This is protected data.',
    user,
  };
});
