import type { UserSettingsDto } from '../../../shared/types/user-settings';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';

export default defineEventHandler(async (event): Promise<UserSettingsDto> => {
  const { user } = await requireAuth(event);
  const [row] = await db
    .select({ timezone: users.timezone, weekStart: users.weekStart })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  return { timezone: row.timezone, weekStart: row.weekStart as 'monday' | 'sunday' };
});
