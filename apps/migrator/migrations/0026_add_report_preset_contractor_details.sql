-- Optional contractor details printed on the client report title page (workspace-report-presets REQ-511).
-- Existing presets read as NULL ("no details"), so no backfill is needed.
ALTER TABLE "report_presets" ADD COLUMN "contractorDetails" text;
