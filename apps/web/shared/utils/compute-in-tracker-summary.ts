/** One linked row's view of its tracker's same-day logs. */
export interface InTrackerLogState {
  trackerId: string;
  name: string;
  loading: boolean;
  loaded: boolean;
  errorKey: string | null;
  logs: readonly { remoteLogId: string; durationSeconds: number }[];
}

export type InTrackerSummary =
  | { status: 'loading' }
  | { status: 'unavailable'; trackers: { name: string; messageKey: string; retryable: boolean }[] }
  | { status: 'ready'; logsSeconds: number; toSendSeconds: number; totalSeconds: number };

/** Never expose a partial estimate while any linked tracker's logs are incomplete. */
export function computeInTrackerSummary(
  logStates: readonly InTrackerLogState[],
  toSendSeconds: number,
): InTrackerSummary {
  if (logStates.some((state) => state.loading || (!state.loaded && !state.errorKey))) {
    return { status: 'loading' };
  }

  const failures = new Map<string, { name: string; messageKey: string; retryable: boolean }>();
  for (const state of logStates) {
    if (state.errorKey) {
      failures.set(state.trackerId, {
        name: state.name,
        messageKey: state.errorKey,
        retryable: state.errorKey !== 'error.extensionUnavailable',
      });
    }
  }
  if (failures.size) return { status: 'unavailable', trackers: [...failures.values()] };

  const seen = new Set<string>();
  let logsSeconds = 0;
  for (const state of logStates) {
    for (const log of state.logs) {
      const key = `${state.trackerId}:${log.remoteLogId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      logsSeconds += log.durationSeconds;
    }
  }
  return { status: 'ready', logsSeconds, toSendSeconds, totalSeconds: logsSeconds + toSendSeconds };
}
