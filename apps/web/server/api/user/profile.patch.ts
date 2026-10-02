import { eq } from 'drizzle-orm';
import { profileSchema, type ProfileDto } from '../../../shared/types/profile';
import { getDb } from '../../db';
import { users } from '../../db/schema';
import { readZodBody } from '../../utils/zod-input';

/**
 * Partially updates the authenticated user's display name and/or timezone
 * (workspace-settings REQ-399), then refreshes the session so the sealed
 * cookie carries the new profile.
 */
export default defineEventHandler(async (event): Promise<ProfileDto> => {
  const db = getDb();
  const session = await requireAuth(event);
  const update = await readZodBody(event, profileSchema);

  const [updated] = await db
    .update(users)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning({ displayName: users.displayName, timezone: users.timezone });
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'User not found' });

  await setUserSession(event, { ...session, user: { ...session.user, ...updated } });
  return updated;
});
