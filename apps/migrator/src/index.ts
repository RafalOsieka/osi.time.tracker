import { fileURLToPath } from 'node:url';
import { Hash } from '@adonisjs/hash';
import { Scrypt } from '@adonisjs/hash/drivers/scrypt';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';

/**
 * The committed SQL migrations. Resolved from this module's location, so it points
 * at `apps/migrator/migrations` both from `src/` (dev, tests) and from the bundled
 * `dist/cli.mjs` in the Docker image, which ships the folder next to `dist/`.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/** The initial user seeded during the migrate step (core-authentication REQ-012). */
export type BootstrapUser = {
  email: string;
  password: string;
  displayName: string;
  timezone: string;
};

/** Mirrors the app's display name limit (workspace-settings REQ-397). */
const DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * Reads the bootstrap user from the `BOOTSTRAP_USER_*` variables.
 * Returns `undefined` when the email or password is unset or empty, so seeding is
 * skipped silently. The email is trimmed and lowercased to match how the app looks
 * users up. The display name defaults to the email local part and the timezone to
 * `UTC`. Throws, naming the variable, when either optional value is invalid.
 */
export function readBootstrapUser(env: NodeJS.ProcessEnv): BootstrapUser | undefined {
  const email = env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = env.BOOTSTRAP_USER_PASSWORD;
  if (!email || !password) return undefined;

  const displayName = env.BOOTSTRAP_USER_DISPLAY_NAME?.trim() || email.split('@')[0] || email;
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(
      `BOOTSTRAP_USER_DISPLAY_NAME must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    );
  }

  const timezone = env.BOOTSTRAP_USER_TIMEZONE?.trim() || 'UTC';
  // `UTC` is the default but is not part of Intl's canonical zone list.
  if (timezone !== 'UTC' && !Intl.supportedValuesOf('timeZone').includes(timezone)) {
    throw new Error(`BOOTSTRAP_USER_TIMEZONE "${timezone}" is not a supported IANA timezone.`);
  }

  return { email, password, displayName, timezone };
}

/**
 * Hashes a password with scrypt defaults — the format `nuxt-auth-utils`'s
 * `verifyPassword` accepts, since the app configures no custom scrypt options.
 */
export async function hashPassword(password: string): Promise<string> {
  return new Hash(new Scrypt({})).make(password);
}

/**
 * Inserts the bootstrap user unless a user with that email already exists; an
 * existing user's password, display name and timezone are never touched. Returns whether a row was inserted.
 * Expects an already-normalized email (see {@link readBootstrapUser}).
 */
export async function seedBootstrapUser(sql: Sql, user: BootstrapUser): Promise<boolean> {
  const passwordHash = await hashPassword(user.password);
  const inserted = await sql`
    INSERT INTO users ("email", "passwordHash", "displayName", "timezone")
    VALUES (${user.email}, ${passwordHash}, ${user.displayName}, ${user.timezone})
    ON CONFLICT ("email") DO NOTHING
    RETURNING "id"
  `;

  return inserted.length > 0;
}

/**
 * Applies all pending migrations to the database at `databaseUrl`, then seeds the
 * bootstrap user when one is given. Uses a single dedicated connection that is
 * always closed, so the one-shot process can exit promptly.
 */
export async function runMigrations(
  databaseUrl: string,
  options: { migrationsFolder?: string; bootstrapUser?: BootstrapUser } = {},
): Promise<void> {
  // Notices (e.g. "schema already exists, skipping") are expected noise here.
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(sql), {
      migrationsFolder: options.migrationsFolder ?? MIGRATIONS_FOLDER,
    });

    if (options.bootstrapUser) {
      await seedBootstrapUser(sql, options.bootstrapUser);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
