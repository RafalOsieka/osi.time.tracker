import { z } from 'zod';
import type { RemoteIssueRefDto } from './remote-issue-ref';

export const TIME_ENTRY_TITLE_MAX_LENGTH = 200;

// Tolerance for "not in the future" checks, absorbing client/server clock skew.
export const TIME_ENTRY_CLOCK_SKEW_TOLERANCE_MS = 60_000;

export const startTimeEntrySchema = z
  .object({
    title: z
      .string({ error: 'error.timeEntryTitleInvalid' })
      .trim()
      .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' })
      .nullish(),
    projectId: z.uuid({ error: 'error.timeEntryProjectInvalid' }).nullish(),
    taskId: z.uuid({ error: 'error.timeEntryTaskInvalid' }).nullish(),
    startedAt: z.iso.datetime({ offset: true, error: 'error.timeEntryStartedAtInvalid' }).nullish(),
    stoppedAt: z.iso.datetime({ offset: true, error: 'error.timeEntryStoppedAtInvalid' }).nullish(),
  })
  .refine((value) => (value.startedAt == null) === (value.stoppedAt == null), {
    path: ['startedAt'],
    error: 'error.timeEntryManualPairIncomplete',
  })
  .refine(
    (value) =>
      value.startedAt == null ||
      value.stoppedAt == null ||
      new Date(value.startedAt).getTime() <= new Date(value.stoppedAt).getTime(),
    {
      path: ['startedAt'],
      error: 'error.timeEntryStartAfterStop',
    },
  )
  .refine(
    (value) =>
      value.startedAt == null ||
      new Date(value.startedAt).getTime() <= Date.now() + TIME_ENTRY_CLOCK_SKEW_TOLERANCE_MS,
    {
      path: ['startedAt'],
      error: 'error.timeEntryStartedAtInFuture',
    },
  );

export type StartTimeEntryDto = z.infer<typeof startTimeEntrySchema>;

export const updateTimeEntrySchema = z.object({
  startedAt: z.iso.datetime({ offset: true, error: 'error.timeEntryStartedAtInvalid' }).nullish(),
  stoppedAt: z.iso.datetime({ offset: true, error: 'error.timeEntryStoppedAtInvalid' }).nullish(),
  title: z
    .string({ error: 'error.timeEntryTitleInvalid' })
    .trim()
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' })
    .nullish(),
  projectId: z.uuid({ error: 'error.timeEntryProjectInvalid' }).nullish(),
  taskId: z.uuid({ error: 'error.timeEntryTaskInvalid' }).nullish(),
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
  remoteIssueRef?: RemoteIssueRefDto;
}

/** Newest entry instant for the authenticated user, or `null` when none exist. */
export type LatestTimeEntryDto = { startedAt: string } | null;

export const listTimeEntriesQuerySchema = z
  .object({
    from: z.iso.datetime({ offset: true, error: 'error.timeEntryRangeInvalid' }),
    to: z.iso.datetime({ offset: true, error: 'error.timeEntryRangeInvalid' }),
  })
  .refine((value) => new Date(value.from).getTime() < new Date(value.to).getTime(), {
    path: ['from'],
    error: 'error.timeEntryRangeInvalid',
  });

export type ListTimeEntriesQuery = z.infer<typeof listTimeEntriesQuerySchema>;

export const bulkAssignSchema = z.object({
  ids: z
    .array(z.uuid({ error: 'error.timeEntryIdsInvalid' }))
    .min(1, { error: 'error.timeEntryIdsInvalid' }),
  title: z
    .string({ error: 'error.timeEntryTitleInvalid' })
    .trim()
    .min(1, { error: 'error.timeEntryTitleInvalid' })
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' }),
  projectId: z.uuid({ error: 'error.timeEntryProjectInvalid' }).nullish(),
});

export type BulkAssignDto = z.infer<typeof bulkAssignSchema>;

export const reassignTimeEntriesSchema = z.object({
  ids: z
    .array(z.uuid({ error: 'error.timeEntryIdsInvalid' }))
    .min(1, { error: 'error.timeEntryIdsInvalid' }),
  name: z
    .string({ error: 'error.timeEntryTitleInvalid' })
    .trim()
    .min(1, { error: 'error.timeEntryTitleInvalid' })
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' })
    .optional(),
  projectId: z.uuid({ error: 'error.timeEntryProjectInvalid' }).nullish(),
});

export type ReassignTimeEntriesDto = z.infer<typeof reassignTimeEntriesSchema>;

const hhMmTimeSchema = z
  .string({ error: 'error.timeEntryStartedAtInvalid' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'error.timeEntryStartedAtInvalid' });

/**
 * Client-side form schema for the timer add-entry dialog (local HH:mm range).
 */
export const timerAddEntryFormSchema = z
  .object({
    title: z
      .string({ error: 'error.timeEntryTitleInvalid' })
      .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' }),
    startTime: hhMmTimeSchema,
    endTime: hhMmTimeSchema,
  })
  .refine((value) => value.startTime <= value.endTime, {
    path: ['endTime'],
    error: 'timerView.addEntry.rangeError',
  });

export type TimerAddEntryFormDto = z.infer<typeof timerAddEntryFormSchema>;

/**
 * Client-side form schema for the timer bulk-assign dialog.
 */
export const timerBulkAssignFormSchema = z.object({
  title: z
    .string({ error: 'timerView.bulkAssign.nameRequiredError' })
    .trim()
    .min(1, { error: 'timerView.bulkAssign.nameRequiredError' })
    .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' }),
  projectId: z.uuid({ error: 'error.timeEntryProjectInvalid' }).nullish(),
});

export type TimerBulkAssignFormDto = z.infer<typeof timerBulkAssignFormSchema>;
