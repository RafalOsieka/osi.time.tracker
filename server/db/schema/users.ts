import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  displayName: text('displayName'),
  timezone: text('timezone'),
  weekStart: text('week_start').notNull().default('monday'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
});
