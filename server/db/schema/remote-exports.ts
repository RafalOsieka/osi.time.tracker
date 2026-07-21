import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  jsonb,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { timeEntries } from './time-entries';

/**
 * One append-only record per successfully finalized remote time log.
 * There is intentionally no task/day or entry uniqueness constraint: later
 * and intentional repeat exports are valid (REQ-119).
 */
export const remoteExports = pgTable(
  'remote_exports',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    taskId: uuid('taskId')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    /** Local calendar day the export covers (`YYYY-MM-DD` in the user's timezone). */
    localDate: date('localDate').notNull(),
    remoteIssueId: text('remoteIssueId').notNull(),
    /** Remote time-log identifier returned by OpenProject (or equivalent). */
    remoteLogId: text('remoteLogId').notNull(),
    /** Exact duration seconds submitted in the finalized export payload. */
    exportDurationSeconds: integer('exportDurationSeconds').notNull(),
    /** Required remote field values submitted with the export (e.g. activity). */
    requiredFieldValues: jsonb('requiredFieldValues')
      .notNull()
      .default({})
      .$type<Record<string, string>>(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('remote_exports_userId_idx').on(table.userId),
    index('remote_exports_userId_localDate_idx').on(table.userId, table.localDate),
    index('remote_exports_taskId_idx').on(table.taskId),
    index('remote_exports_userId_taskId_localDate_idx').on(
      table.userId,
      table.taskId,
      table.localDate,
    ),
    index('remote_exports_remoteLogId_idx').on(table.remoteLogId),
  ],
);

/**
 * Junction associating each successfully exported local time entry with the
 * export record that included it. Multiple associations for the same entry
 * are allowed across different exports (intentional repeats).
 */
export const remoteExportEntries = pgTable(
  'remote_export_entries',
  {
    exportId: uuid('exportId')
      .notNull()
      .references(() => remoteExports.id, { onDelete: 'cascade' }),
    entryId: uuid('entryId')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    primaryKey({ columns: [table.exportId, table.entryId], name: 'remote_export_entries_pk' }),
    index('remote_export_entries_entryId_idx').on(table.entryId),
    index('remote_export_entries_userId_idx').on(table.userId),
  ],
);
