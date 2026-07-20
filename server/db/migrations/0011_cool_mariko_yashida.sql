UPDATE "remote_system_configs" SET "executionMode" = 'server' WHERE "transportMode" = 'proxied';--> statement-breakpoint
ALTER TABLE "remote_system_configs" DROP COLUMN "transportMode";