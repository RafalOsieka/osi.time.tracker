/**
 * Documentation aliases for task-keyed sync UI maps.
 * Not branded nominal types — keys remain plain strings at compile time.
 */
export type TaskId = string;

export type ActivityByTask = Partial<Record<TaskId, string | null>>;

export type IssueRefByTask = Partial<
  Record<TaskId, { remoteIssueId: string; cachedTitle: string }>
>;

export type SelectedEntryIdsByTask = Partial<Record<TaskId, string[]>>;

export type DismissedDuplicatesByTask = Partial<Record<TaskId, boolean>>;

export type ExportCommentsByTask = Partial<Record<TaskId, string>>;

/** Full Record (not Partial) so empty `{}` seeds and dialog props stay assignable. */
export type ExportOutcomesByTask<TOutcome> = Record<TaskId, TOutcome>;

export type ExportProgressByTask<TStatus> = Record<TaskId, TStatus>;
