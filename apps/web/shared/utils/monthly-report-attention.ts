export const ATTENTION_REASONS = ['direct', 'unexported', 'remoteOnly', 'fetchFailed'] as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export interface AttentionTrackerHours {
  appSeconds: number;
  directSeconds: number;
  fetchFailed: boolean;
}

/**
 * Day-level attention. Rounding-only Local vs App differences are not reasons.
 */
export function attentionReasons(input: {
  localSeconds: number;
  trackers: readonly AttentionTrackerHours[];
}): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const anyFetchFailed = input.trackers.some((tracker) => tracker.fetchFailed);
  if (anyFetchFailed) {
    reasons.push('fetchFailed');
  }

  const successful = input.trackers.filter((tracker) => !tracker.fetchFailed);
  const anyDirect = successful.some((tracker) => tracker.directSeconds > 0);
  if (anyDirect) {
    reasons.push('direct');
  }

  const remoteSeconds = successful.reduce(
    (sum, tracker) => sum + tracker.appSeconds + tracker.directSeconds,
    0,
  );

  if (input.localSeconds > 0 && !anyFetchFailed && remoteSeconds === 0) {
    reasons.push('unexported');
  }

  if (input.localSeconds === 0 && remoteSeconds > 0) {
    reasons.push('remoteOnly');
  }

  return reasons;
}
