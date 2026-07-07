import { z } from 'zod';

export const TIME_ENTRY_TITLE_MAX_LENGTH = 200;

export const startTimeEntrySchema = z.object({
  title: z
    .string({ invalid_type_error: 'error.timeEntryTitleInvalid' })
    .trim()
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { message: 'error.timeEntryTitleTooLong' })
    .nullish(),
  projectId: z
    .string({ invalid_type_error: 'error.timeEntryProjectInvalid' })
    .uuid({ message: 'error.timeEntryProjectInvalid' })
    .nullish(),
});

export type StartTimeEntryDto = z.infer<typeof startTimeEntrySchema>;

export const updateTimeEntrySchema = z.object({
  stoppedAt: z
    .string({ invalid_type_error: 'error.timeEntryStoppedAtInvalid' })
    .datetime({ message: 'error.timeEntryStoppedAtInvalid' })
    .nullish(),
  title: z
    .string({ invalid_type_error: 'error.timeEntryTitleInvalid' })
    .trim()
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { message: 'error.timeEntryTitleTooLong' })
    .nullish(),
  projectId: z
    .string({ invalid_type_error: 'error.timeEntryProjectInvalid' })
    .uuid({ message: 'error.timeEntryProjectInvalid' })
    .nullish(),
});

export type UpdateTimeEntryDto = z.infer<typeof updateTimeEntrySchema>;

export interface TimeEntryDto {
  id: string;
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  startedAt: string;
  stoppedAt: string | null;
}
