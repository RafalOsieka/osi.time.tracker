import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { projects } from './projects';

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
    number: integer('number').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tasks_userId_number_unique').on(table.userId, table.number),
    index('tasks_userId_projectId_idx').on(table.userId, table.projectId),
  ],
);
