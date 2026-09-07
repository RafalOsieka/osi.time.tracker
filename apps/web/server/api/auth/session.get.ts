/**
 * Session ("me") endpoint.
 *
 * Returns the current login state without requiring authentication, so the
 * client can hydrate `useUserSession` and render the appropriate UI.
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  return {
    loggedIn: Boolean(session.user),
    user: session.user ?? null,
  };
});
