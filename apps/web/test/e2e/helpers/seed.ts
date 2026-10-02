import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createDatabaseClient } from '../../../server/db/client';
import { users } from '../../../server/db/schema/users';

// oxlint-disable-next-line typescript/no-explicit-any -- dynamic import of hasher module has no stable type
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
  displayName: string;
  timezone: string;
};

type SeedUserInput = {
  email: string;
  password?: string;
  displayName?: string;
  timezone?: string;
};

/**
 * Seeds a list of users into the given database. Display name defaults to
 * `Test User` and timezone to `UTC`.
 */
export async function seedUsers(
  databaseUrl: string,
  usersList: SeedUserInput[],
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
          displayName: item.displayName ?? 'Test User',
          timezone: item.timezone ?? 'UTC',
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          timezone: users.timezone,
        });
      if (!row) throw new Error(`failed to seed user ${email}`);
      seeded.push({
        id: row.id,
        email: row.email,
        password,
        displayName: row.displayName,
        timezone: row.timezone,
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
  options: Partial<SeedUserInput> = {},
): Promise<SeededUser> {
  const email = options.email ?? `user-${randomUUID()}@example.com`;
  const [user] = await seedUsers(databaseUrl, [{ ...options, email }]);
  if (!user) throw new Error('failed to seed user');
  return user;
}
