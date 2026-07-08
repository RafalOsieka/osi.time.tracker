-- Data migration: tasks become hard-delete only. Before dropping the
-- deletedAt column, untitle time entries pointing at soft-deleted tasks and
-- hard-delete those task rows so no orphaned/soft-deleted data remains.
UPDATE "time_entries"
SET "taskId" = NULL, "updatedAt" = now()
WHERE "taskId" IN (SELECT "id" FROM "tasks" WHERE "deletedAt" IS NOT NULL);--> statement-breakpoint
DELETE FROM "tasks" WHERE "deletedAt" IS NOT NULL;--> statement-breakpoint
DROP INDEX "tasks_userId_projectId_name_unique";--> statement-breakpoint
DROP INDEX "tasks_userId_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_userId_projectId_name_unique" ON "tasks" USING btree ("userId","projectId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_userId_name_unique" ON "tasks" USING btree ("userId","name") WHERE "tasks"."projectId" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "deletedAt";