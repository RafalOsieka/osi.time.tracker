CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"taskId" uuid,
	"startedAt" timestamp with time zone NOT NULL,
	"stoppedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "tasks_userId_number_unique";--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_taskId_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entries_userId_idx" ON "time_entries" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_userId_running_unique" ON "time_entries" USING btree ("userId") WHERE "time_entries"."stoppedAt" IS NULL;--> statement-breakpoint
-- Dedup step: before the new (userId, projectId, name) partial unique index is
-- created, soft-delete duplicate non-deleted task rows sharing the same scope,
-- keeping only the earliest-created row per scope so historical rows are
-- preserved rather than destroyed.
WITH "ranked_tasks" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId", COALESCE("projectId"::text, ''), "name"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS "rank"
  FROM "tasks"
  WHERE "deletedAt" IS NULL
)
UPDATE "tasks"
SET "deletedAt" = now()
WHERE "id" IN (SELECT "id" FROM "ranked_tasks" WHERE "rank" > 1);--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_userId_projectId_name_unique" ON "tasks" USING btree ("userId","projectId","name") WHERE "tasks"."deletedAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_userId_name_unique" ON "tasks" USING btree ("userId","name") WHERE "tasks"."projectId" IS NULL AND "tasks"."deletedAt" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "number";