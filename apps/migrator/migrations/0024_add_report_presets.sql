CREATE TABLE "report_presets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"userId" uuid NOT NULL,
	"clientName" text NOT NULL,
	"hoursFormat" text NOT NULL,
	"locale" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_preset_trackers" (
	"presetId" uuid NOT NULL,
	"trackerId" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "report_preset_trackers_pk" PRIMARY KEY("presetId","trackerId")
);
--> statement-breakpoint
ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_preset_trackers" ADD CONSTRAINT "report_preset_trackers_presetId_report_presets_id_fk" FOREIGN KEY ("presetId") REFERENCES "public"."report_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_preset_trackers" ADD CONSTRAINT "report_preset_trackers_trackerId_trackers_id_fk" FOREIGN KEY ("trackerId") REFERENCES "public"."trackers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_presets_userId_clientName_unique" ON "report_presets" USING btree ("userId",lower("clientName"));--> statement-breakpoint
CREATE INDEX "report_preset_trackers_trackerId_idx" ON "report_preset_trackers" USING btree ("trackerId");
