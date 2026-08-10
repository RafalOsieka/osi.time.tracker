import { pgTable, uuid, text, timestamp, index, uniqueIndex, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';
import { trackers } from './trackers';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    projectId: uuid('projectId').references(() => projects.id),
    name: text('name').notNull(),
    /**
     * Inline remote issue reference. `remoteIssueId IS NULL` means the task
     * is unlinked; when set, tracker provenance and cached title are required
     * by application logic and form part of the uniqueness key.
     */
    trackerId: uuid('trackerId').references(() => trackers.id),
    remoteIssueId: text('remoteIssueId'),
    remoteIssueCachedTitle: text('remoteIssueCachedTitle'),
    remoteIssueCreatedAt: timestamp('remoteIssueCreatedAt', { withTimezone: true }),
    remoteIssueUpdatedAt: timestamp('remoteIssueUpdatedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NULLS NOT DISTINCT so at most one unlinked task exists per
    // (userId, projectId, name); different remote issues may share a name.
    unique('tasks_userId_projectId_name_remoteIssueId_unique')
      .on(table.userId, table.projectId, table.name, table.remoteIssueId)
      .nullsNotDistinct(),
    // Project-less scope keeps a matching partial unique index.
    uniqueIndex('tasks_userId_name_remoteIssueId_unique')
      .on(table.userId, table.name, table.remoteIssueId)
      .where(sql`${table.projectId} IS NULL`),
    index('tasks_userId_projectId_idx').on(table.userId, table.projectId),
  ],
);
