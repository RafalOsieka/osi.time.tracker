ALTER TABLE "remote_exports" ADD COLUMN "trackerId" uuid;--> statement-breakpoint
UPDATE "remote_exports" AS e
SET "trackerId" = COALESCE(t."trackerId", p."trackerId")
FROM "tasks" AS t
LEFT JOIN "projects" AS p ON p.id = t."projectId"
WHERE e."taskId" = t.id;--> statement-breakpoint
DO $$
DECLARE
  bad_ids text;
BEGIN
  SELECT string_agg(id::text, ', ') INTO bad_ids
  FROM "remote_exports"
  WHERE "trackerId" IS NULL;
  IF bad_ids IS NOT NULL THEN
    RAISE EXCEPTION 'remote_exports trackerId backfill failed for ids: %', bad_ids;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "remote_exports" ALTER COLUMN "trackerId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "remote_exports" ADD CONSTRAINT "remote_exports_trackerId_trackers_id_fk" FOREIGN KEY ("trackerId") REFERENCES "public"."trackers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "remote_exports_trackerId_idx" ON "remote_exports" USING btree ("trackerId");--> statement-breakpoint
CREATE UNIQUE INDEX "remote_exports_userId_trackerId_remoteLogId_uidx" ON "remote_exports" USING btree ("userId","trackerId","remoteLogId");
