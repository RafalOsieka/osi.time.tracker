import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { trackers } from './trackers';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    trackerId: uuid('trackerId').references(() => trackers.id),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    // Partial unique index among active rows. The committed migration adds
    // NULLS NOT DISTINCT so local projects (trackerId null) stay unique per
    // (userId, name); drizzle's uniqueIndex builder does not expose that flag.
    uniqueIndex('projects_userId_trackerId_name_unique')
      .on(table.userId, table.trackerId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('projects_userId_trackerId_idx').on(table.userId, table.trackerId),
  ],
);
