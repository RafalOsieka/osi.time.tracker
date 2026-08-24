import { apiLogin, type ApiSession } from './auth';
import { seedUser, type SeededUser } from './seed';

export type SeededSession = SeededUser & ApiSession;

/**
 * Seed a unique user and log in over HTTP. Use once per mutating `it`.
 */
export async function seedAndLogin(
  databaseUrl: string,
  options: { email?: string; password?: string; displayName?: string } = {},
): Promise<SeededSession> {
  const user = await seedUser(databaseUrl, options);
  const session = await apiLogin(user.email, user.password);
  return { ...user, ...session };
}
