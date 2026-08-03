-- Fan every remote_issue_refs row onto its owning task before dropping the table.
ALTER TABLE "tasks" ADD COLUMN "remoteSystemConfigId" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "remoteIssueId" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "remoteIssueCachedTitle" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "remoteIssueCreatedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "remoteIssueUpdatedAt" timestamp with time zone;--> statement-breakpoint
UPDATE "tasks" AS t
SET
  "remoteSystemConfigId" = r."remoteSystemConfigId",
  "remoteIssueId" = r."remoteIssueId",
  "remoteIssueCachedTitle" = r."cachedTitle",
  "remoteIssueCreatedAt" = r."createdAt",
  "remoteIssueUpdatedAt" = r."updatedAt"
FROM "remote_issue_refs" AS r
WHERE r."taskId" = t."id";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_remoteSystemConfigId_remote_system_configs_id_fk" FOREIGN KEY ("remoteSystemConfigId") REFERENCES "public"."remote_system_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_issue_refs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "remote_issue_refs" CASCADE;--> statement-breakpoint
ALTER TABLE "remote_exports" DROP CONSTRAINT "remote_exports_taskId_tasks_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_userId_projectId_name_unique";--> statement-breakpoint
DROP INDEX "tasks_userId_name_unique";--> statement-breakpoint
ALTER TABLE "remote_exports" ALTER COLUMN "taskId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_exports" ADD CONSTRAINT "remote_exports_taskId_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_userId_name_remoteIssueId_unique" ON "tasks" USING btree ("userId","name","remoteIssueId") NULLS NOT DISTINCT WHERE "tasks"."projectId" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_projectId_name_remoteIssueId_unique" UNIQUE NULLS NOT DISTINCT("userId","projectId","name","remoteIssueId");
