import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { clients } from './clients';
import type {
  RemoteSystemType,
  RemoteExecutionMode,
  RemoteRoundingRule,
} from '../../../shared/types/remote-system-config';

export const remoteSystemConfigs = pgTable(
  'remote_system_configs',
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
    systemType: text('systemType').notNull().$type<RemoteSystemType>(),
    baseUrl: text('baseUrl').notNull(),
    executionMode: text('executionMode').notNull().$type<RemoteExecutionMode>(),
    roundingRule: text('roundingRule').notNull().$type<RemoteRoundingRule>(),
    requiredFieldDefaults: jsonb('requiredFieldDefaults')
      .notNull()
      .default({})
      .$type<Record<string, string>>(),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deletedAt', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('remote_system_configs_clientId_unique')
      .on(table.clientId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);
