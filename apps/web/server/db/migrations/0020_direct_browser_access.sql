ALTER TABLE "trackers" ADD COLUMN "directBrowserAccess" boolean;--> statement-breakpoint
UPDATE "trackers" SET "directBrowserAccess" = ("executionMode" = 'client');--> statement-breakpoint
ALTER TABLE "trackers" ALTER COLUMN "directBrowserAccess" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "trackers" ALTER COLUMN "directBrowserAccess" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trackers" DROP COLUMN "executionMode";
