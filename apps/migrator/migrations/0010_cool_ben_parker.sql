CREATE TABLE "remote_export_entries" (
	"exportId" uuid NOT NULL,
	"entryId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "remote_export_entries_pk" PRIMARY KEY("exportId","entryId")
);
--> statement-breakpoint
CREATE TABLE "remote_exports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"taskId" uuid NOT NULL,
	"localDate" date NOT NULL,
	"remoteIssueId" text NOT NULL,
	"remoteLogId" text NOT NULL,
	"exportDurationSeconds" integer NOT NULL,
	"requiredFieldValues" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remote_export_entries" ADD CONSTRAINT "remote_export_entries_exportId_remote_exports_id_fk" FOREIGN KEY ("exportId") REFERENCES "public"."remote_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_export_entries" ADD CONSTRAINT "remote_export_entries_entryId_time_entries_id_fk" FOREIGN KEY ("entryId") REFERENCES "public"."time_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_export_entries" ADD CONSTRAINT "remote_export_entries_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_exports" ADD CONSTRAINT "remote_exports_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_exports" ADD CONSTRAINT "remote_exports_taskId_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remote_export_entries_entryId_idx" ON "remote_export_entries" USING btree ("entryId");--> statement-breakpoint
CREATE INDEX "remote_export_entries_userId_idx" ON "remote_export_entries" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "remote_exports_userId_idx" ON "remote_exports" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "remote_exports_userId_localDate_idx" ON "remote_exports" USING btree ("userId","localDate");--> statement-breakpoint
CREATE INDEX "remote_exports_taskId_idx" ON "remote_exports" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "remote_exports_userId_taskId_localDate_idx" ON "remote_exports" USING btree ("userId","taskId","localDate");--> statement-breakpoint
CREATE INDEX "remote_exports_remoteLogId_idx" ON "remote_exports" USING btree ("remoteLogId");