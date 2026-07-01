import { z } from 'zod';

export const PROJECT_NAME_MAX_LENGTH = 100;

export const createProjectSchema = z.object({
  name: z
    .string({
      required_error: 'error.projectNameRequired',
      invalid_type_error: 'error.projectNameRequired',
    })
    .trim()
    .min(1, { message: 'error.projectNameRequired' })
    .max(PROJECT_NAME_MAX_LENGTH, { message: 'error.projectNameTooLong' }),
  clientId: z
    .string({
      required_error: 'error.projectClientRequired',
      invalid_type_error: 'error.projectClientRequired',
    })
    .uuid({ message: 'error.projectClientRequired' }),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema;

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export interface ProjectDto {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  createdAt: string;
}
