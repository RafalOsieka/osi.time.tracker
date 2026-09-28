-- Promote remote_system_configs → trackers, drop clients, optional project.trackerId.
-- Stable config/tracker row ids are preserved so browser secrets and task refs keep working.

-- 1. Prepare columns on the existing config table and projects.
ALTER TABLE "remote_system_configs" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "trackerId" uuid;--> statement-breakpoint

-- 2. Active client + active config → tracker name from client; re-parent projects.
UPDATE "remote_system_configs" AS rsc
SET "name" = c."name"
FROM "clients" AS c
WHERE rsc."clientId" = c."id"
  AND rsc."deletedAt" IS NULL
  AND c."deletedAt" IS NULL;--> statement-breakpoint

UPDATE "projects" AS p
SET "trackerId" = rsc."id"
FROM "remote_system_configs" AS rsc
INNER JOIN "clients" AS c ON c."id" = rsc."clientId"
WHERE p."clientId" = c."id"
  AND rsc."deletedAt" IS NULL
  AND c."deletedAt" IS NULL;--> statement-breakpoint

-- Soft-deleted / orphan configs still need a non-null name before the NOT NULL constraint.
UPDATE "remote_system_configs" AS rsc
SET "name" = COALESCE(rsc."name", c."name", 'Archived tracker')
FROM "clients" AS c
WHERE rsc."clientId" = c."id"
  AND rsc."name" IS NULL;--> statement-breakpoint

UPDATE "remote_system_configs"
SET "name" = 'Archived tracker'
WHERE "name" IS NULL;--> statement-breakpoint

-- 3. Auto-suffix name clashes among active local projects (trackerId IS NULL) per user.
-- Deterministic " (n)" suffix; loop until the partial unique index would accept the set.
DO $$
DECLARE
  collision_count integer;
BEGIN
  LOOP
    WITH ranked AS (
      SELECT
        p.id,
        p.name,
        ROW_NUMBER() OVER (
          PARTITION BY p."userId", p.name
          ORDER BY p."createdAt", p.id
        ) AS rn
      FROM "projects" AS p
      WHERE p."trackerId" IS NULL
        AND p."deletedAt" IS NULL
    ),
    to_fix AS (
      SELECT id, name, rn
      FROM ranked
      WHERE rn > 1
    )
    UPDATE "projects" AS p
    SET name = tf.name || ' (' || tf.rn || ')'
    FROM to_fix AS tf
    WHERE p.id = tf.id;

    GET DIAGNOSTICS collision_count = ROW_COUNT;
    EXIT WHEN collision_count = 0;
  END LOOP;
END $$;--> statement-breakpoint

-- 4. Rename task provenance column (values unchanged — same uuid as former config id).
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_remoteSystemConfigId_remote_system_configs_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "remoteSystemConfigId" TO "trackerId";--> statement-breakpoint

-- 5. Drop project client FK/indexes and clientId column.
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_clientId_clients_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "projects_userId_clientId_name_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "projects_userId_clientId_idx";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "clientId";--> statement-breakpoint

-- 6. Drop config↔client coupling, then rename table to trackers.
ALTER TABLE "remote_system_configs" DROP CONSTRAINT IF EXISTS "remote_system_configs_clientId_clients_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "remote_system_configs_clientId_unique";--> statement-breakpoint
ALTER TABLE "remote_system_configs" DROP COLUMN "clientId";--> statement-breakpoint
ALTER TABLE "remote_system_configs" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_system_configs" RENAME TO "trackers";--> statement-breakpoint

-- 7. Recreate indexes/FKs on the renamed table and projects.trackerId.
CREATE UNIQUE INDEX "trackers_userId_name_unique" ON "trackers" USING btree ("userId", "name") WHERE "trackers"."deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "trackers_userId_idx" ON "trackers" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_trackerId_trackers_id_fk" FOREIGN KEY ("trackerId") REFERENCES "public"."trackers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_userId_trackerId_name_unique" ON "projects" USING btree ("userId", "trackerId", "name") NULLS NOT DISTINCT WHERE "projects"."deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "projects_userId_trackerId_idx" ON "projects" USING btree ("userId", "trackerId");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_trackerId_trackers_id_fk" FOREIGN KEY ("trackerId") REFERENCES "public"."trackers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- 8. Drop clients entirely.
DROP TABLE "clients" CASCADE;
