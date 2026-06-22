import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';

/**
 * Normalizes an email address to lowercase and trims surrounding whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Finds a user in the database by their email (normalizing it first).
 */
export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0] || null;
}

/**
 * Creates a new user with a hashed password.
 */
export async function createUser({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email: normalized,
      passwordHash,
      displayName,
    })
    .returning();

  return user;
}

// A constant dummy hash used for timing-safe verification when the email is unknown.
// Generated using scrypt.
export const DUMMY_HASH =
  '$scrypt$n=16384,r=8,p=1$somesalt12345678$e5d8a8b1c431d102e3b2a5c6d7e8f900112233445566778899aabbccddeeff00';
