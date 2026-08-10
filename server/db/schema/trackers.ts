import { pgTable, uuid, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import type {
  TrackerSystemType,
  TrackerExecutionMode,
  TrackerRoundingRule,
} from '../../../shared/types/tracker';

export const trackers = pgTable(
  'trackers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    systemType: text('systemType').notNull().$type<TrackerSystemType>(),
    baseUrl: text('baseUrl').notNull(),
    executionMode: text('executionMode').notNull().$type<TrackerExecutionMode>(),
    roundingRule: text('roundingRule').notNull().$type<TrackerRoundingRule>(),
    requiredFieldDefaults: jsonb('requiredFieldDefaults')
      .notNull()
      .default({})
      .$type<Record<string, string>>(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('trackers_userId_name_unique')
      .on(table.userId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('trackers_userId_idx').on(table.userId),
  ],
);
