import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { tasks, projects, clients } from '../db/schema';
import type { TimeEntryDto } from '../../shared/types/time-entry';

interface TimeEntryRow {
  id: string;
  taskId: string | null;
  startedAt: Date;
  stoppedAt: Date | null;
}

/**
 * Enriches a raw `time_entries` row with the resolved task/project/client
 * names and serializes timestamps to ISO strings for the API boundary.
 */
export async function toTimeEntryDto(row: TimeEntryRow): Promise<TimeEntryDto> {
  let taskName: string | null = null;
  let projectId: string | null = null;
  let projectName: string | null = null;
  let clientName: string | null = null;

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
          .select({ name: projects.name, clientId: projects.clientId })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (project) {
          projectName = project.name;
          const [client] = await db
            .select({ name: clients.name })
            .from(clients)
            .where(eq(clients.id, project.clientId))
            .limit(1);
          clientName = client?.name ?? null;
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
    clientName,
    startedAt: row.startedAt.toISOString(),
    stoppedAt: row.stoppedAt ? row.stoppedAt.toISOString() : null,
  };
}
