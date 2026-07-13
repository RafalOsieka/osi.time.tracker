import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { userSettingsSchema, type UserSettingsDto } from '../../../shared/types/user-settings';
import { db } from '../../db';
import { users } from '../../db/schema';
import { mapZodError } from '../../utils/zod-error';
import type { ApiMessage } from '../../types/api-message';

export default defineEventHandler(async (event): Promise<UserSettingsDto> => {
  const session = await requireAuth(event);
  let update;
  try {
    update = userSettingsSchema.parse(await readBody(event));
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw createError({ statusCode: 422, data: mapZodError(error) satisfies ApiMessage });
    }
    throw error;
  }

  const [updated] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, session.user.id))
    .returning({ timezone: users.timezone, weekStart: users.weekStart });
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  const settings: UserSettingsDto = {
    timezone: updated.timezone,
    weekStart: updated.weekStart as 'monday' | 'sunday',
  };
  await setUserSession(event, { ...session, user: { ...session.user, settings } });
  return settings;
});
