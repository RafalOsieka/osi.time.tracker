import { expect, it } from 'vitest';
import { createDatabaseClient } from '../../server/db/client';
import { requireDocker } from './support/guards';
import { provisionEmptyDatabase } from './support/database';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const describeDb = requireDocker();

/**
 * Seeds a pre-0015 dataset (clients + remote_system_configs + projects),
 * applies 0015_drop_clients_promote_trackers, and asserts happy-path
 * re-parenting, orphan flatten, and local name auto-suffix.
 */
describeDb('drop-clients-promote-trackers migration', () => {
  it('promotes active client+config to tracker, flattens orphans, suffixes local name clashes', async () => {
    const dbUrl = await provisionEmptyDatabase();
    const { sql } = createDatabaseClient(dbUrl, { max: 5 });

    try {
      const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');
      // Apply every migration except 0015 so we sit on the pre-change schema.
      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && !f.startsWith('0015_'))
        .sort();
      for (const file of files) {
        const content = readFileSync(join(migrationsDir, file), 'utf8');
        for (const statement of content.split('--> statement-breakpoint')) {
          const trimmed = statement.trim();
          if (trimmed) await sql.unsafe(trimmed);
        }
      }

      const [user] = await sql<{ id: string }[]>`
        INSERT INTO "users" ("email", "passwordHash")
        VALUES ('migrate-trackers@example.com', 'hash')
        RETURNING id
      `;
      if (!user) throw new Error('user');

      // Happy path: active client + active config → tracker inherits client name
      const [clientA] = await sql<{ id: string }[]>`
        INSERT INTO "clients" ("userId", "name")
        VALUES (${user.id}, 'Acme Corp')
        RETURNING id
      `;
      const [configA] = await sql<{ id: string }[]>`
        INSERT INTO "remote_system_configs"
          ("userId", "clientId", "systemType", "baseUrl", "executionMode", "roundingRule")
        VALUES
          (${user.id}, ${clientA!.id}, 'openproject', 'https://op.example.com', 'client', 'none')
        RETURNING id
      `;
      const [linkedProject] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "clientId", "name")
        VALUES (${user.id}, ${clientA!.id}, 'Linked Project')
        RETURNING id
      `;

      // Soft-deleted client with a project → orphan flatten to local (trackerId null)
      const [softClient] = await sql<{ id: string }[]>`
        INSERT INTO "clients" ("userId", "name", "deletedAt")
        VALUES (${user.id}, 'Soft Client', NOW())
        RETURNING id
      `;
      const [orphanProject] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "clientId", "name")
        VALUES (${user.id}, ${softClient!.id}, 'Orphan Project')
        RETURNING id
      `;

      // Local name clash setup: after flatten, two active local projects named "Shared"
      // (one already local-ish via another soft-deleted client; one will be flattened).
      const [softClient2] = await sql<{ id: string }[]>`
        INSERT INTO "clients" ("userId", "name", "deletedAt")
        VALUES (${user.id}, 'Soft Client 2', NOW())
        RETURNING id
      `;
      const [clashA] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "clientId", "name", "createdAt")
        VALUES (${user.id}, ${softClient!.id}, 'Shared', '2026-01-01T00:00:00Z')
        RETURNING id
      `;
      const [clashB] = await sql<{ id: string }[]>`
        INSERT INTO "projects" ("userId", "clientId", "name", "createdAt")
        VALUES (${user.id}, ${softClient2!.id}, 'Shared', '2026-01-02T00:00:00Z')
        RETURNING id
      `;

      // Apply migration 0015
      const migration15 = readFileSync(
        join(migrationsDir, '0015_drop_clients_promote_trackers.sql'),
        'utf8',
      );
      for (const statement of migration15.split('--> statement-breakpoint')) {
        const trimmed = statement.trim();
        if (trimmed) await sql.unsafe(trimmed);
      }

      // clients table gone; trackers table present
      const clientsLeft = await sql<{ c: string }[]>`
        SELECT count(*)::text AS c FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'clients'
      `;
      expect(Number(clientsLeft[0]!.c)).toBe(0);
      const trackersPresent = await sql<{ c: string }[]>`
        SELECT count(*)::text AS c FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'trackers'
      `;
      expect(Number(trackersPresent[0]!.c)).toBe(1);

      // Happy path: stable config id kept, name from client, project re-parented
      const trackerRows = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM trackers WHERE id = ${configA!.id}
      `;
      expect(trackerRows).toHaveLength(1);
      expect(trackerRows[0]!.name).toBe('Acme Corp');

      const linkedAfter = await sql<{ trackerId: string | null }[]>`
        SELECT "trackerId" FROM projects WHERE id = ${linkedProject!.id}
      `;
      expect(linkedAfter[0]!.trackerId).toBe(configA!.id);

      // Orphan flatten
      const orphanAfter = await sql<{ trackerId: string | null }[]>`
        SELECT "trackerId" FROM projects WHERE id = ${orphanProject!.id}
      `;
      expect(orphanAfter[0]!.trackerId).toBeNull();

      // Local name auto-suffix: one keeps "Shared", the later one becomes "Shared (2)"
      const clashNames = await sql<{ id: string; name: string }[]>`
        SELECT id, name FROM projects
        WHERE id IN (${clashA!.id}, ${clashB!.id})
        ORDER BY "createdAt", id
      `;
      expect(clashNames.map((r) => r.name)).toEqual(['Shared', 'Shared (2)']);
      expect(clashNames.every((r) => r.id === clashA!.id || r.id === clashB!.id)).toBe(true);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
