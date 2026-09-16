import { expect, it } from 'vitest';
import { createDatabaseClient } from '../../../server/db/client';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';

const describeDb = requireDocker();

describeDb('time_entries schema', () => {
  it('has a (taskId, startedAt) index backing the most-recently-used lookup', async () => {
    const dbUrl = await provisionDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const indexes = await sql<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'time_entries' AND indexname = 'time_entries_taskId_startedAt_idx'
      `;
      expect(indexes).toHaveLength(1);
      expect(indexes[0]?.indexdef).toContain('"taskId"');
      expect(indexes[0]?.indexdef).toContain('"startedAt"');
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
