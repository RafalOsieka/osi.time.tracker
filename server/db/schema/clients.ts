import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('clients_userId_name_unique')
      .on(table.userId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('clients_userId_idx').on(table.userId),
  ],
);
