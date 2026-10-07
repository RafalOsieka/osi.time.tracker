/**
 * Typed outcome of deleting one remote time entry (REQ-307). Callers must not
 * treat `unknown` as confirmed deletion.
 */
export type RemoteTimeEntryDeleteOutcome =
  | { status: 'deleted' }
  | { status: 'not_found' }
  | { status: 'rejected'; messageKey: string }
  | { status: 'unknown'; messageKey: string };

/**
 * A single remote time log shown as informational context beside a linked
 * task. Never used to infer local provenance.
 */
export interface RemoteTimeLogDto {
  remoteLogId: string;
  remoteIssueId: string;
  /** Local calendar day the remote log is spent on (`YYYY-MM-DD`). */
  spentOn: string;
  /** Duration in seconds as reported by the remote system. */
  durationSeconds: number;
  activityId: string | null;
  activityName: string | null;
  comment: string | null;
  /** Remote user id of the log author (current account only is displayed). */
  remoteUserId: string | null;
  /**
   * Opaque remote project id, present only when the provider's time-log
   * payload already names the project (REQ-341). Used by remote-log import
   * to route a log to a local Project by scope; never fetched separately.
   */
  remoteProjectId?: string;
  /** Remote project display title, present under the same condition. */
  remoteProjectTitle?: string;
  /**
   * Remote issue display title for every provider: taken from the time-log
   * payload when present, otherwise resolved by the adapter through a
   * batched issue lookup (REQ-341/REQ-378). `null` (REQ-476) only when the tracker
   * does not disclose the issue to this account (deleted or not visible) —
   * never because of the provider type.
   */
  remoteIssueTitle: string | null;
}
