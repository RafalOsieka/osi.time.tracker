import type { TaskDto } from '../../shared/types/task';

/**
 * Formats a task suggestion label for the top-bar timer autocomplete:
 * `name · project #<remoteIssueId>` (project and remote id are included
 * only when present).
 */
export function formatTaskSuggestionLabel(task: TaskDto, noProjectLabel: string): string {
  const parts: string[] = [task.name];

  if (task.projectName) {
    parts.push(task.projectName);
  } else {
    parts.push(noProjectLabel);
  }

  let label = parts.join(' · ');
  if (task.remoteIssueRef?.remoteIssueId) {
    label += ` #${task.remoteIssueRef.remoteIssueId}`;
  }
  return label;
}
