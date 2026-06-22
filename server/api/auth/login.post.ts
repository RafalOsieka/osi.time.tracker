import { findUserByEmail, DUMMY_HASH } from '../../utils/users';

/**
 * Login endpoint.
 *
 * Validates the submitted credentials shape and establishes a sealed session
 * cookie via `setUserSession`.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event);

  const emailInput = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!emailInput || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required.',
    });
  }

  const user = await findUserByEmail(emailInput);
  let isPasswordValid = false;

  if (user) {
    isPasswordValid = await verifyPassword(user.passwordHash, password);
  } else {
    // Timing-safe verification against dummy hash
    await verifyPassword(DUMMY_HASH, password);
  }

  if (!user || !isPasswordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials.',
    });
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    loggedInAt: Date.now(),
  });

  return {
    loggedIn: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };
});
