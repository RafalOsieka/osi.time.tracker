/**
 * Resolves the default export comment for a task:
 * 1. Most recent non-empty remote-log comment for the linked issue
 * 2. Otherwise the task name
 */
export function resolveDefaultExportComment(
  taskName: string,
  remoteLogComments: readonly (string | null | undefined)[],
): string {
  for (const comment of remoteLogComments) {
    const trimmed = comment?.trim();
    if (trimmed) return trimmed;
  }
  return taskName;
}

/**
 * Comment actually sent to the remote tracker: empty/whitespace falls back
 * to the task name so we never create a remote log with a blank note.
 */
export function resolveExportComment(comment: string | null | undefined, taskName: string): string {
  const trimmed = comment?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : taskName;
}
