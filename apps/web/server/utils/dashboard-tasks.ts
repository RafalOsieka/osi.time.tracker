import { DASHBOARD_TOP_TASKS, type DashboardTaskDto } from '../../shared/types/dashboard';
import { completedSeconds, type StoppedEntryInstants } from './monthly-report';
import { activeIssueUrl, type IssueTrackerRef } from './remote-issue-refs';

interface TaskDetails {
  task: {
    id: string;
    name: string;
    remoteIssueId: string | null;
    remoteIssueCachedTitle: string | null;
  };
  project: { id: string; name: string; deletedAt: Date | null } | null;
  issueTracker: IssueTrackerRef | null;
}

/** A Time entry of the period; an untitled one has no Task. */
export type TaskEntry = StoppedEntryInstants &
  Omit<TaskDetails, 'task'> & { task: TaskDetails['task'] | null };

/**
 * The Tasks with the most time, one per Task identity, most first and equal ones in creation
 * order. Untitled entries belong to no Task and are left out.
 */
export function topTasks(entries: readonly TaskEntry[]): DashboardTaskDto[] {
  const byTask = new Map<string, TaskDetails & { totalSeconds: number }>();
  for (const { task, project, issueTracker, ...instants } of entries) {
    if (!task) continue;
    const ranked = byTask.get(task.id) ?? { task, project, issueTracker, totalSeconds: 0 };
    ranked.totalSeconds += completedSeconds(instants);
    byTask.set(task.id, ranked);
  }

  return (
    [...byTask.values()]
      .filter(({ totalSeconds }) => totalSeconds > 0)
      // Ids are time-ordered, which gives equal Tasks their creation order.
      .sort(
        (left, right) =>
          right.totalSeconds - left.totalSeconds || left.task.id.localeCompare(right.task.id),
      )
      .slice(0, DASHBOARD_TOP_TASKS)
      .map(({ task, project, issueTracker, totalSeconds }) => ({
        id: task.id,
        name: task.name,
        project: project
          ? { id: project.id, name: project.name, deleted: project.deletedAt !== null }
          : null,
        remoteIssue: task.remoteIssueId
          ? {
              id: task.remoteIssueId,
              // Linking always caches a title, the id when the Tracker gave none.
              title: task.remoteIssueCachedTitle ?? task.remoteIssueId,
              url: activeIssueUrl(issueTracker, task.remoteIssueId) ?? null,
            }
          : null,
        totalSeconds,
      }))
  );
}
