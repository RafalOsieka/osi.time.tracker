import { createRequire } from 'node:module';
import { createDatabaseClient } from '../../../server/db/client';
import { users } from '../../../server/db/schema/users';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Seeds a list of users into the given database.
 */
export async function seedUsers(
  databaseUrl: string,
  usersList: { email: string; password?: string; displayName?: string }[],
): Promise<void> {
  const hasher = await getHasher();
  const { db, sql } = createDatabaseClient(databaseUrl);

  try {
    for (const item of usersList) {
      const passwordHash = await hasher.make(item.password ?? 'secret');
      await db.insert(users).values({
        email: item.email.toLowerCase(),
        passwordHash,
        displayName: item.displayName ?? null,
      });
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
