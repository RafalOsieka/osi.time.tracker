import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
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
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tasks_userId_projectId_name_unique')
      .on(table.userId, table.projectId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('tasks_userId_name_unique')
      .on(table.userId, table.name)
      .where(sql`${table.projectId} IS NULL AND ${table.deletedAt} IS NULL`),
    index('tasks_userId_projectId_idx').on(table.userId, table.projectId),
  ],
);
