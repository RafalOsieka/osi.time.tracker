-- Display name and timezone become required (workspace-settings REQ-397 / REQ-398).
-- Backfill first: missing or blank names take the email local part, missing timezones become UTC.
UPDATE "users" SET "displayName" = split_part("email", '@', 1)
  WHERE "displayName" IS NULL OR btrim("displayName") = '';--> statement-breakpoint
UPDATE "users" SET "timezone" = 'UTC' WHERE "timezone" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "displayName" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "timezone" SET NOT NULL;
