import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { clients } from './clients';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    clientId: uuid('clientId')
      .notNull()
      .references(() => clients.id),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('projects_userId_clientId_name_unique')
      .on(table.userId, table.clientId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('projects_userId_clientId_idx').on(table.userId, table.clientId),
  ],
);
