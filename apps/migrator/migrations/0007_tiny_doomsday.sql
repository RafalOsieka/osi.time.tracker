CREATE TABLE "remote_system_configs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"clientId" uuid NOT NULL,
	"systemType" text NOT NULL,
	"baseUrl" text NOT NULL,
	"executionMode" text NOT NULL,
	"roundingRule" text NOT NULL,
	"requiredFieldDefaults" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "remote_system_configs" ADD CONSTRAINT "remote_system_configs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remote_system_configs" ADD CONSTRAINT "remote_system_configs_clientId_clients_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "remote_system_configs_clientId_unique" ON "remote_system_configs" USING btree ("clientId") WHERE "remote_system_configs"."deletedAt" IS NULL;