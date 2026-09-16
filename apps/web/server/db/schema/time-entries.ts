import { pgTable, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    taskId: uuid('taskId').references(() => tasks.id),
    startedAt: timestamp('startedAt', { withTimezone: true }).notNull(),
    stoppedAt: timestamp('stoppedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('time_entries_userId_idx').on(table.userId),
    index('time_entries_userId_startedAt_idx').on(table.userId, table.startedAt),
    // Backs the per-task most-recently-used lookup (task suggestion ranking
    // and title-resolution tie-break) and task-garbage-collection existence
    // checks, both of which filter/order by taskId.
    index('time_entries_taskId_startedAt_idx').on(table.taskId, table.startedAt),
    uniqueIndex('time_entries_userId_running_unique')
      .on(table.userId)
      .where(sql`${table.stoppedAt} IS NULL`),
  ],
);
