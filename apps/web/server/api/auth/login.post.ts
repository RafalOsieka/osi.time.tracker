import { loginSchema, type AuthUser } from '../../../shared/types/auth';
import { findUserByEmail, DUMMY_HASH } from '../../utils/users';
import { readZodBody } from '../../utils/zod-input';
import type { ApiMessage } from '../../types/api-message';

/**
 * Login endpoint.
 *
 * Validates the submitted credentials shape and establishes a sealed session
 * cookie via `setUserSession`.
 */
export default defineEventHandler(async (event) => {
  const { email: emailInput, password } = await readZodBody(event, loginSchema, 400);

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
      data: { messageKey: 'errors.auth.invalidCredentials' } satisfies ApiMessage,
    });
  }

  const sessionUser: AuthUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
  };
  await setUserSession(event, { user: sessionUser, loggedInAt: Date.now() });

  return { loggedIn: true, user: sessionUser };
});
