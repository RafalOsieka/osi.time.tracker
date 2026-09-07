/**
 * Inputs that uniquely identify one logical export attempt for a task/day.
 * Entry ids are sorted before hashing so selection order never changes the key.
 */
export interface ExportRequestKeyInput {
  taskId: string;
  localDate: string;
  entryIds: readonly string[];
  exportDurationSeconds: number;
}

/**
 * Builds a deterministic export request key from the task, local date,
 * selected entry identifiers and export duration (REQ-233).
 *
 * Format: `er1|<taskId>|<localDate>|<sortedEntryIds>|<durationSeconds>`
 * (versioned prefix so future algorithms can coexist without collision).
 */
export function buildExportRequestKey(input: ExportRequestKeyInput): string {
  const sortedEntries = [...input.entryIds]
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
  return [
    'er1',
    input.taskId,
    input.localDate,
    sortedEntries.join(','),
    String(Math.trunc(input.exportDurationSeconds)),
  ].join('|');
}
