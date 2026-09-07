CREATE TABLE "remote_issue_refs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"taskId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"remoteSystemConfigId" uuid NOT NULL,
	"remoteIssueId" text NOT NULL,
	"cachedTitle" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remote_issue_refs" ADD CONSTRAINT "remote_issue_refs_taskId_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_issue_refs" ADD CONSTRAINT "remote_issue_refs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_issue_refs" ADD CONSTRAINT "remote_issue_refs_remoteSystemConfigId_remote_system_configs_id_fk" FOREIGN KEY ("remoteSystemConfigId") REFERENCES "public"."remote_system_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "remote_issue_refs_taskId_unique" ON "remote_issue_refs" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "remote_issue_refs_userId_idx" ON "remote_issue_refs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "remote_issue_refs_remoteSystemConfigId_idx" ON "remote_issue_refs" USING btree ("remoteSystemConfigId");