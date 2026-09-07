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
}
