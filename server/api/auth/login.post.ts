/**
 * Login endpoint.
 *
 * Validates the submitted credentials shape and establishes a sealed session
 * cookie via `setUserSession`. Credential verification against persisted users
 * is intentionally out of scope for this change (no user storage yet), so any
 * well-formed input is accepted and the username is stored on the session.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: unknown; password?: unknown }>(event);

  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password are required.',
    });
  }

  await setUserSession(event, {
    user: { name: username },
    loggedInAt: Date.now(),
  });

  return { loggedIn: true, user: { name: username } };
});
