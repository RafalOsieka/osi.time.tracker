import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createDatabaseClient } from '../../../server/db/client';
import { users } from '../../../server/db/schema/users';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import of hasher module has no stable type
let sharedHasher: any;

async function getHasher() {
  if (!sharedHasher) {
    const requireModule = createRequire(import.meta.resolve('nuxt-auth-utils'));
    const hashMjsPath = 'file:///' + requireModule.resolve('@adonisjs/hash').replace(/\\/g, '/');
    const scryptMjsPath =
      'file:///' + requireModule.resolve('@adonisjs/hash/drivers/scrypt').replace(/\\/g, '/');
    const { Hash } = await import(hashMjsPath);
    const { Scrypt } = await import(scryptMjsPath);
    sharedHasher = new Hash(new Scrypt({}));
  }
  return sharedHasher;
}

export type SeededUser = {
  id: string;
  email: string;
  password: string;
  displayName: string | null;
};

/**
 * Seeds a list of users into the given database.
 */
export async function seedUsers(
  databaseUrl: string,
  usersList: { email: string; password?: string; displayName?: string }[],
): Promise<SeededUser[]> {
  const hasher = await getHasher();
  const { db, sql } = createDatabaseClient(databaseUrl);
  const seeded: SeededUser[] = [];

  try {
    for (const item of usersList) {
      const password = item.password ?? 'secret';
      const passwordHash = await hasher.make(password);
      const email = item.email.toLowerCase();
      const [row] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          displayName: item.displayName ?? null,
        })
        .returning({ id: users.id, email: users.email, displayName: users.displayName });
      if (!row) throw new Error(`failed to seed user ${email}`);
      seeded.push({
        id: row.id,
        email: row.email,
        password,
        displayName: row.displayName,
      });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  return seeded;
}

/**
 * Seeds one unique user. Mutating HTTP/UI tests should call this per `it`.
 */
export async function seedUser(
  databaseUrl: string,
  options: { email?: string; password?: string; displayName?: string } = {},
): Promise<SeededUser> {
  const email = options.email ?? `user-${randomUUID()}@example.com`;
  const [user] = await seedUsers(databaseUrl, [
    { email, password: options.password, displayName: options.displayName },
  ]);
  if (!user) throw new Error('failed to seed user');
  return user;
}
