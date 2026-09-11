import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tasks } from './tasks';
import { timeEntries } from './time-entries';
import { trackers } from './trackers';

/**
 * One record per successfully finalized or linked remote time log.
 * There is intentionally no task/day or entry uniqueness constraint: later
 * exports after deletion remain valid (REQ-119). Remote-entry identity is the
 * workspace pair `(trackerId, remoteLogId)` (REQ-304).
 * `exportRequestKey` is unique per user when present so retries reconcile
 * to the same logical export (REQ-233).
 *
 * `taskId` is nullable with ON DELETE SET NULL so export provenance survives
 * task garbage collection (REQ-237) instead of cascading away or blocking GC.
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
    taskId: uuid('taskId').references(() => tasks.id, { onDelete: 'set null' }),
    /** Tracker that owns the remote log; required for tracker-scoped identity. */
    trackerId: uuid('trackerId')
      .notNull()
      .references(() => trackers.id),
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
    /**
     * Client-generated idempotency key for this logical export attempt.
     * Nullable so legacy records remain valid; unique per user when set.
     */
    exportRequestKey: text('exportRequestKey'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('remote_exports_userId_idx').on(table.userId),
    index('remote_exports_userId_localDate_idx').on(table.userId, table.localDate),
    index('remote_exports_taskId_idx').on(table.taskId),
    index('remote_exports_trackerId_idx').on(table.trackerId),
    index('remote_exports_userId_taskId_localDate_idx').on(
      table.userId,
      table.taskId,
      table.localDate,
    ),
    index('remote_exports_remoteLogId_idx').on(table.remoteLogId),
    uniqueIndex('remote_exports_userId_trackerId_remoteLogId_uidx').on(
      table.userId,
      table.trackerId,
      table.remoteLogId,
    ),
    uniqueIndex('remote_exports_userId_exportRequestKey_uidx')
      .on(table.userId, table.exportRequestKey)
      .where(sql`${table.exportRequestKey} is not null`),
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
