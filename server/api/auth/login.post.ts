import { ZodError } from 'zod';
import { loginSchema } from '../../../shared/types/auth';
import type { LoginDto } from '../../../shared/types/auth';
import { findUserByEmail, DUMMY_HASH } from '../../utils/users';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

/**
 * Login endpoint.
 *
 * Validates the submitted credentials shape and establishes a sealed session
 * cookie via `setUserSession`.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  let credentials: LoginDto;
  try {
    credentials = loginSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        data: mapZodError(err) satisfies ApiMessage,
      });
    }
    throw err;
  }

  const { email: emailInput, password } = credentials;

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

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      settings: { timezone: user.timezone, weekStart: user.weekStart as 'monday' | 'sunday' },
    },
    loggedInAt: Date.now(),
  });

  return {
    loggedIn: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      settings: { timezone: user.timezone, weekStart: user.weekStart as 'monday' | 'sunday' },
    },
  };
});
