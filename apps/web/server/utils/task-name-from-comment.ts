/**
 * Task name for an imported log (REQ-336): the remote log's comment,
 * trimmed. A null, empty, or whitespace-only comment names the task the
 * literal `empty` rather than fetching the remote issue title.
 */
export function taskNameFromComment(comment: string | null): string {
  const trimmed = comment?.trim() ?? '';
  return trimmed || 'empty';
}
