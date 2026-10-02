import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { trackers } from './trackers';
import type { ReportHoursFormat, ReportLocale } from '../../../shared/types/report-preset';

/**
 * A saved client report setup (REQ-380). Client names are unique per user
 * ignoring case. `lastUsedAt` orders the preset list (REQ-381) and is bumped
 * on every save, which the client report export performs first (REQ-386).
 */
export const reportPresets = pgTable(
  'report_presets',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    clientName: text('clientName').notNull(),
    hoursFormat: text('hoursFormat').notNull().$type<ReportHoursFormat>(),
    locale: text('locale').notNull().$type<ReportLocale>(),
    lastUsedAt: timestamp('lastUsedAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('report_presets_userId_clientName_unique').on(
      table.userId,
      sql`lower(${table.clientName})`,
    ),
  ],
);

/**
 * Ordered trackers of a report preset. Trackers are only soft-deleted, so the
 * foreign key never blocks; the list endpoint hides inactive ones and counts them.
 */
export const reportPresetTrackers = pgTable(
  'report_preset_trackers',
  {
    presetId: uuid('presetId')
      .notNull()
      .references(() => reportPresets.id, { onDelete: 'cascade' }),
    trackerId: uuid('trackerId')
      .notNull()
      .references(() => trackers.id),
    position: integer('position').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.presetId, table.trackerId], name: 'report_preset_trackers_pk' }),
    index('report_preset_trackers_trackerId_idx').on(table.trackerId),
  ],
);
