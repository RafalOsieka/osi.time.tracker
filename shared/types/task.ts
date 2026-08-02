import { z } from 'zod';
import type { RemoteIssueRefDto } from './remote-issue-ref';

export const TASK_NAME_MAX_LENGTH = 100;

export const updateTaskSchema = z.object({
  name: z
    .string({ error: 'error.taskNameRequired' })
    .trim()
    .min(1, { error: 'error.taskNameRequired' })
    .max(TASK_NAME_MAX_LENGTH, { error: 'error.taskNameTooLong' }),
  projectId: z.uuid({ error: 'error.taskProjectInvalid' }).nullish(),
});

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export interface TaskDto {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  createdAt: string;
  remoteIssueRef?: RemoteIssueRefDto;
}

export interface ListTasksQuery {
  projectId?: string;
  search?: string;
}
