CREATE INDEX "time_entries_taskId_startedAt_idx" ON "time_entries" USING btree ("taskId","startedAt");
