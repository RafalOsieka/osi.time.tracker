import { expect, it } from 'vitest';
import { MIGRATIONS_FOLDER } from '@osi/migrator';
import { createDatabaseClient } from '../../../server/db/client';
import { requireDocker } from '../harness/guards';
import { provisionEmptyDatabase } from '../harness/database';
import { applySqlFile, migrationFilesBefore, readMigrationSql } from '../harness/migrations';

const describeDb = requireDocker();

type ProfileRow = { email: string; displayName: string; timezone: string };

/**
 * Seeds pre-0025 users with missing or blank profile fields, applies
 * 0025_require_user_profile, and asserts the backfill plus the NOT NULL
 * constraints (workspace-settings REQ-397 / REQ-398).
 */
describeDb('require-user-profile migration', () => {
  it('backfills display name and timezone, then rejects users without them', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      for (const file of migrationFilesBefore(25)) {
        await applySqlFile(sql, readMigrationSql(file));
      }

      await sql`
        INSERT INTO "users" ("email", "passwordHash", "displayName", "timezone") VALUES
          ('jan.kowalski@example.com', 'hash', NULL, NULL),
          ('blank@example.com', 'hash', '   ', 'Europe/Warsaw'),
          ('kept@example.com', 'hash', 'Kept Name', 'America/New_York')
      `;

      await applySqlFile(sql, readMigrationSql('0025_require_user_profile.sql', MIGRATIONS_FOLDER));

      const rows = await sql<ProfileRow[]>`
        SELECT "email", "displayName", "timezone" FROM "users" ORDER BY "email"
      `;
      expect(rows).toEqual([
        { email: 'blank@example.com', displayName: 'blank', timezone: 'Europe/Warsaw' },
        { email: 'jan.kowalski@example.com', displayName: 'jan.kowalski', timezone: 'UTC' },
        { email: 'kept@example.com', displayName: 'Kept Name', timezone: 'America/New_York' },
      ]);

      await expect(sql`
        INSERT INTO "users" ("email", "passwordHash", "timezone")
        VALUES ('no-name@example.com', 'hash', 'UTC')
      `).rejects.toThrow(/displayName/);
      await expect(sql`
        INSERT INTO "users" ("email", "passwordHash", "displayName")
        VALUES ('no-timezone@example.com', 'hash', 'No Timezone')
      `).rejects.toThrow(/timezone/);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
