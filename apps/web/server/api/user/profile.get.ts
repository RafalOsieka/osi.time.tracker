import { eq } from 'drizzle-orm';
import type { ProfileDto } from '../../../shared/types/profile';
import { getDb } from '../../db';
import { users } from '../../db/schema';

/** Returns the authenticated user's profile (workspace-settings REQ-493). */
export default defineEventHandler(async (event): Promise<ProfileDto> => {
  const db = getDb();
  const { user } = await requireAuth(event);
  const [row] = await db
    .select({ displayName: users.displayName, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'User not found' });
  return row;
});
