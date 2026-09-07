/**
 * Input row for day-total derivation. Predicates and durations are injected
 * by the page so this stays a pure, unit-testable reconciliation.
 */
export interface RemoteSyncDayTotalsRow {
  /** Full task duration for the day (all completed entries). */
  totalSeconds: number;
  /** Export duration after rounding/overrides (0 when excluded by duration). */
  exportSeconds: number;
  /** True when the row will actually be pushed (Ready, non-zero, activity). */
  isPushable: boolean;
  /** True when the task/date already has finalized provenance. */
  isSent: boolean;
}

export interface RemoteSyncDayTotals {
  dayTotal: number;
  tracked: number;
  toSend: number;
  blocked: number;
  sent: number;
  untitled: number;
  /** Signed difference `toSend - tracked`. */
  delta: number;
}

/**
 * Computes the three reconciling day summaries plus sent/blocked/untitled
 * amounts. Invariant: `dayTotal = tracked + sent + blocked + untitled`.
 *
 * - **day total**: every completed entry on the day
 * - **tracked**: full duration of pushable Ready rows
 * - **to send**: export durations of pushable Ready rows
 * - **sent**: full duration of rows with provenance
 * - **blocked**: everything else (unlinked, no activity, Ready with 0 to-send)
 * - **untitled**: untitled bucket duration
 */
export function computeRemoteSyncDayTotals(
  rows: readonly RemoteSyncDayTotalsRow[],
  untitledSeconds: number,
): RemoteSyncDayTotals {
  let dayTotal = Math.max(0, untitledSeconds);
  let tracked = 0;
  let toSend = 0;
  let blocked = 0;
  let sent = 0;

  for (const row of rows) {
    const total = Math.max(0, row.totalSeconds);
    dayTotal += total;

    if (row.isSent) {
      sent += total;
      continue;
    }

    if (row.isPushable) {
      tracked += total;
      toSend += Math.max(0, row.exportSeconds);
      continue;
    }

    blocked += total;
  }

  const untitled = Math.max(0, untitledSeconds);

  return {
    dayTotal,
    tracked,
    toSend,
    blocked,
    sent,
    untitled,
    delta: toSend - tracked,
  };
}
