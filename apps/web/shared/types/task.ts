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
  createdAt: string;
  remoteIssueRef?: RemoteIssueRefDto;
}

/** Default and maximum for `listTasksQuerySchema`'s `limit` (title-suggestion cap). */
export const TASK_LIST_DEFAULT_LIMIT = 20;
export const TASK_LIST_MAX_LIMIT = 100;

export const listTasksQuerySchema = z.object({
  projectId: z.string().optional(),
  // Trimmed; blank collapses to `undefined` so callers need not special-case it.
  search: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  limit: z.coerce
    .number({ error: 'error.taskLimitInvalid' })
    .int({ error: 'error.taskLimitInvalid' })
    .min(1, { error: 'error.taskLimitInvalid' })
    .max(TASK_LIST_MAX_LIMIT, { error: 'error.taskLimitInvalid' })
    .default(TASK_LIST_DEFAULT_LIMIT),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
