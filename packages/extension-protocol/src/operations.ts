import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import { z } from 'zod';

export const EXTENSION_OPERATION_NAMES = [
  'searchIssues',
  'getIssueById',
  'getActivityOptions',
  'getCurrentAccount',
  'fetchTimeLogs',
  'fetchTimeLogsInRange',
  'createTimeEntry',
] as const;

export const operationNameSchema = z.enum(EXTENSION_OPERATION_NAMES);

export type ExtensionOperationName = z.infer<typeof operationNameSchema>;

export const requestIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const secretSchema = z.string().min(1).max(8192);

export const remoteIssueSearchResultSchema = z.object({
  remoteIssueId: z.string(),
  title: z.string(),
  remoteProjectTitle: z.string().optional(),
});

export const remoteFieldOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const remoteAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const remoteTimeLogSchema = z.object({
  remoteLogId: z.string(),
  remoteIssueId: z.string(),
  spentOn: z.string(),
  durationSeconds: z.number(),
  activityId: z.string().nullable(),
  activityName: z.string().nullable(),
  comment: z.string().nullable(),
  remoteUserId: z.string().nullable(),
});

export const searchIssuesInputSchema = z.string();
export const searchIssuesResultSchema = z.array(remoteIssueSearchResultSchema);

export const getIssueByIdInputSchema = z.string();
export const getIssueByIdResultSchema = remoteIssueSearchResultSchema.nullable();

export const getActivityOptionsInputSchema = z.string();
export const getActivityOptionsResultSchema = z.array(remoteFieldOptionSchema);

export const getCurrentAccountInputSchema = z.null();
export const getCurrentAccountResultSchema = remoteAccountSchema;

export const fetchTimeLogsInputSchema = z.object({
  spentOn: z.string(),
  workPackageIds: z.array(z.string()),
  userId: z.string().optional(),
});
export const fetchTimeLogsResultSchema = z.array(remoteTimeLogSchema);

export const fetchTimeLogsInRangeInputSchema = z.object({
  from: z.string(),
  to: z.string(),
  userId: z.string().optional(),
});
export const fetchTimeLogsInRangeResultSchema = z.array(remoteTimeLogSchema);

export const createTimeEntryInputSchema = z.object({
  remoteIssueId: z.string(),
  spentOn: z.string(),
  durationSeconds: z.number(),
  activityId: z.string(),
  comment: z.string().optional(),
});
export const createTimeEntryResultSchema = z.object({
  remoteLogId: z.string(),
});

export type SearchIssuesInput = z.infer<typeof searchIssuesInputSchema>;
export type SearchIssuesResult = z.infer<typeof searchIssuesResultSchema>;
export type GetIssueByIdInput = z.infer<typeof getIssueByIdInputSchema>;
export type GetIssueByIdResult = z.infer<typeof getIssueByIdResultSchema>;
export type GetActivityOptionsInput = z.infer<typeof getActivityOptionsInputSchema>;
export type GetActivityOptionsResult = z.infer<typeof getActivityOptionsResultSchema>;
export type GetCurrentAccountInput = z.infer<typeof getCurrentAccountInputSchema>;
export type GetCurrentAccountResult = z.infer<typeof getCurrentAccountResultSchema>;
export type FetchTimeLogsInput = z.infer<typeof fetchTimeLogsInputSchema>;
export type FetchTimeLogsResult = z.infer<typeof fetchTimeLogsResultSchema>;
export type FetchTimeLogsInRangeInput = z.infer<typeof fetchTimeLogsInRangeInputSchema>;
export type FetchTimeLogsInRangeResult = z.infer<typeof fetchTimeLogsInRangeResultSchema>;
export type CreateTimeEntryInput = z.infer<typeof createTimeEntryInputSchema>;
export type CreateTimeEntryResult = z.infer<typeof createTimeEntryResultSchema>;

const operationRequestBase = {
  type: z.literal('operation'),
  requestId: requestIdSchema,
  provider: trackerSystemTypeSchema,
  baseUrl: z.url(),
  secret: secretSchema,
};

export const searchIssuesRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('searchIssues'),
  input: searchIssuesInputSchema,
});

export const getIssueByIdRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('getIssueById'),
  input: getIssueByIdInputSchema,
});

export const getActivityOptionsRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('getActivityOptions'),
  input: getActivityOptionsInputSchema,
});

export const getCurrentAccountRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('getCurrentAccount'),
  input: getCurrentAccountInputSchema,
});

export const fetchTimeLogsRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('fetchTimeLogs'),
  input: fetchTimeLogsInputSchema,
});

export const fetchTimeLogsInRangeRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('fetchTimeLogsInRange'),
  input: fetchTimeLogsInRangeInputSchema,
});

export const createTimeEntryRequestSchema = z.object({
  ...operationRequestBase,
  operation: z.literal('createTimeEntry'),
  input: createTimeEntryInputSchema,
});

export const operationRequestSchema = z.discriminatedUnion('operation', [
  searchIssuesRequestSchema,
  getIssueByIdRequestSchema,
  getActivityOptionsRequestSchema,
  getCurrentAccountRequestSchema,
  fetchTimeLogsRequestSchema,
  fetchTimeLogsInRangeRequestSchema,
  createTimeEntryRequestSchema,
]);

export type OperationRequest = z.infer<typeof operationRequestSchema>;

export const searchIssuesSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('searchIssues'),
  ok: z.literal(true),
  result: searchIssuesResultSchema,
});

export const getIssueByIdSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('getIssueById'),
  ok: z.literal(true),
  result: getIssueByIdResultSchema,
});

export const getActivityOptionsSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('getActivityOptions'),
  ok: z.literal(true),
  result: getActivityOptionsResultSchema,
});

export const getCurrentAccountSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('getCurrentAccount'),
  ok: z.literal(true),
  result: getCurrentAccountResultSchema,
});

export const fetchTimeLogsSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('fetchTimeLogs'),
  ok: z.literal(true),
  result: fetchTimeLogsResultSchema,
});

export const fetchTimeLogsInRangeSuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('fetchTimeLogsInRange'),
  ok: z.literal(true),
  result: fetchTimeLogsInRangeResultSchema,
});

export const createTimeEntrySuccessSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: z.literal('createTimeEntry'),
  ok: z.literal(true),
  result: createTimeEntryResultSchema,
});

export const operationSuccessSchema = z.discriminatedUnion('operation', [
  searchIssuesSuccessSchema,
  getIssueByIdSuccessSchema,
  getActivityOptionsSuccessSchema,
  getCurrentAccountSuccessSchema,
  fetchTimeLogsSuccessSchema,
  fetchTimeLogsInRangeSuccessSchema,
  createTimeEntrySuccessSchema,
]);

export type OperationSuccess = z.infer<typeof operationSuccessSchema>;
