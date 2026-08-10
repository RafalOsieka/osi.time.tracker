import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { tasks, projects } from '../db/schema';
import type { TimeEntryDto } from '../../shared/types/time-entry';
import { getRemoteIssueRefForTask } from './remote-issue-refs';

interface TimeEntryRow {
  id: string;
  userId: string;
  taskId: string | null;
  startedAt: Date;
  stoppedAt: Date | null;
}

/**
 * Enriches a raw `time_entries` row with the resolved task/project names and
 * serializes timestamps to ISO strings for the API boundary.
 */
export async function toTimeEntryDto(row: TimeEntryRow): Promise<TimeEntryDto> {
  let taskName: string | null = null;
  let projectId: string | null = null;
  let projectName: string | null = null;
  let remoteIssueRef: TimeEntryDto['remoteIssueRef'];

  if (row.taskId) {
    remoteIssueRef = (await getRemoteIssueRefForTask(row.userId, row.taskId)) ?? undefined;
  }

  if (row.taskId) {
    const [task] = await db
      .select({ name: tasks.name, projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, row.taskId))
      .limit(1);

    if (task) {
      taskName = task.name;
      projectId = task.projectId;

      if (projectId) {
        const [project] = await db
          .select({ name: projects.name })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (project) {
          projectName = project.name;
        }
      }
    }
  }

  return {
    id: row.id,
    taskId: row.taskId,
    taskName,
    projectId,
    projectName,
    startedAt: row.startedAt.toISOString(),
    stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
    remoteIssueRef,
  };
}
