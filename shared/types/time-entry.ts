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
  startedAt: string;
  stoppedAt: string | null;
  remoteIssueRef?: RemoteIssueRefDto;
}

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

export const timerViewFeedQuerySchema = z.object({
  before: z.iso.datetime({ offset: true, error: 'error.timeEntryRangeInvalid' }).optional(),
});

export type TimerViewFeedQuery = z.infer<typeof timerViewFeedQuerySchema>;

export interface TimerViewFeedDto {
  entries: TimeEntryDto[];
  hasMore: boolean;
  nextBefore: string | null;
}

export const TIMER_VIEW_FEED_INITIAL_DAYS = 30;
export const TIMER_VIEW_FEED_LOAD_MORE_ACTIVITY_DAYS = 7;

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

export const reassignTimeEntriesSchema = z
  .object({
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
    /**
     * Three-way presence (mirrors `projectId`): omitted keeps the source
     * task's remote issue, explicit `null` targets the unlinked twin, and a
     * non-empty string targets the task carrying that remote issue.
     */
    remoteIssueId: z
      .string({ error: 'error.remoteIssueIdRequired' })
      .trim()
      .min(1, { error: 'error.remoteIssueIdRequired' })
      .nullish(),
    /**
     * Cached issue title from the client search result, used when creating a
     * newly linked target task. Required when `remoteIssueId` is a non-null
     * value. Tracker provenance is always derived server-side.
     */
    cachedTitle: z
      .string({ error: 'error.remoteIssueTitleRequired' })
      .trim()
      .min(1, { error: 'error.remoteIssueTitleRequired' })
      .optional(),
  })
  .refine(
    (value) =>
      value.remoteIssueId == null || value.remoteIssueId === undefined || !!value.cachedTitle,
    {
      path: ['cachedTitle'],
      error: 'error.remoteIssueTitleRequired',
    },
  );

export type ReassignTimeEntriesDto = z.infer<typeof reassignTimeEntriesSchema>;

const hhMmTimeSchema = z
  .string({ error: 'error.timeEntryStartedAtInvalid' })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'error.timeEntryStartedAtInvalid' });

/**
 * Client-side form schema for the timer add-entry dialog (local date + HH:mm range).
 */
export const timerAddEntryFormSchema = z
  .object({
    title: z
      .string({ error: 'error.timeEntryTitleInvalid' })
      .max(TIME_ENTRY_TITLE_MAX_LENGTH, { error: 'error.timeEntryTitleTooLong' }),
    date: z
      .string({ error: 'error.timeEntryStartedAtInvalid' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'error.timeEntryStartedAtInvalid' }),
    startTime: hhMmTimeSchema,
    endTime: hhMmTimeSchema,
  })
  .refine((value) => value.startTime <= value.endTime, {
    path: ['endTime'],
    error: 'timerView.addEntry.rangeError',
  });

export type TimerAddEntryFormDto = z.infer<typeof timerAddEntryFormSchema>;
