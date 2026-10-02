import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDatabaseClient } from '../../../server/db/client';
import { users } from '../../../server/db/schema/users';
import { trackers } from '../../../server/db/schema/trackers';
import { reportPresets, reportPresetTrackers } from '../../../server/db/schema/report-presets';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';

const describeDb = requireDocker();

describeDb('report presets schema', () => {
  it('rejects a case-insensitive duplicate name per user and cascades tracker rows', async () => {
    const dbUrl = await provisionDatabase();
    const { db, sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const [user, otherUser] = await db
        .insert(users)
        .values([
          { email: 'report-presets-a@example.com', passwordHash: 'hash' },
          { email: 'report-presets-b@example.com', passwordHash: 'hash' },
        ])
        .returning();
      if (!user || !otherUser) throw new Error('users not inserted');

      const [tracker] = await db
        .insert(trackers)
        .values({
          userId: user.id,
          name: 'OP',
          systemType: 'openproject',
          baseUrl: 'https://op.example.com',
          roundingRule: 'none',
        })
        .returning();
      if (!tracker) throw new Error('tracker not inserted');

      const [preset] = await db
        .insert(reportPresets)
        .values({
          userId: user.id,
          clientName: 'Helios Energy',
          hoursFormat: 'decimal',
          locale: 'pl',
        })
        .returning();
      if (!preset) throw new Error('preset not inserted');

      await expect(
        db.insert(reportPresets).values({
          userId: user.id,
          clientName: 'helios energy',
          hoursFormat: 'hm',
          locale: 'en',
        }),
      ).rejects.toThrow();

      // The same name is fine for another user.
      await db.insert(reportPresets).values({
        userId: otherUser.id,
        clientName: 'Helios Energy',
        hoursFormat: 'hm',
        locale: 'en',
      });

      await db
        .insert(reportPresetTrackers)
        .values({ presetId: preset.id, trackerId: tracker.id, position: 0 });

      await db.delete(reportPresets).where(eq(reportPresets.id, preset.id));
      const remaining = await db.select().from(reportPresetTrackers);
      expect(remaining).toHaveLength(0);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
