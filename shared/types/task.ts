import { z } from 'zod';

export const TASK_NAME_MAX_LENGTH = 100;

export const createTaskSchema = z.object({
  name: z
    .string({
      required_error: 'error.taskNameRequired',
      invalid_type_error: 'error.taskNameRequired',
    })
    .trim()
    .min(1, { message: 'error.taskNameRequired' })
    .max(TASK_NAME_MAX_LENGTH, { message: 'error.taskNameTooLong' }),
  projectId: z
    .string({ invalid_type_error: 'error.taskProjectInvalid' })
    .uuid({ message: 'error.taskProjectInvalid' })
    .nullish(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema;

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export interface TaskDto {
  id: string;
  number: number;
  name: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  createdAt: string;
}
