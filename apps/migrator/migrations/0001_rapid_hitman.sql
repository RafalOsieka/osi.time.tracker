CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_userId_name_unique" ON "clients" USING btree ("userId","name") WHERE "clients"."deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX "clients_userId_idx" ON "clients" USING btree ("userId");