import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { remoteSystemConfigs } from './remote-system-configs';

export const remoteIssueRefs = pgTable(
  'remote_issue_refs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    taskId: uuid('taskId')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    remoteSystemConfigId: uuid('remoteSystemConfigId')
      .notNull()
      .references(() => remoteSystemConfigs.id),
    remoteIssueId: text('remoteIssueId').notNull(),
    cachedTitle: text('cachedTitle').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('remote_issue_refs_taskId_unique').on(table.taskId),
    index('remote_issue_refs_userId_idx').on(table.userId),
    index('remote_issue_refs_remoteSystemConfigId_idx').on(table.remoteSystemConfigId),
  ],
);
