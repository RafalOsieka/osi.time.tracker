import { z } from 'zod';

export const PROJECT_NAME_MAX_LENGTH = 100;

export const createProjectSchema = z.object({
  name: z
    .string({
        error: (issue) => issue.input === undefined ? 'error.projectNameRequired' : 'error.projectNameRequired'
    })
    .trim()
    .min(1, {
        error: 'error.projectNameRequired'
    })
    .max(PROJECT_NAME_MAX_LENGTH, {
        error: 'error.projectNameTooLong'
    }),
  clientId: z.uuid({
          error: 'error.projectClientRequired'
      }),
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
