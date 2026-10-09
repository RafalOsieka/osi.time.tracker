/**
 * Input row for day-total derivation. Durations and the Sent flag are injected
 * by the page so this stays a pure, unit-testable reconciliation.
 */
export interface RemoteSyncDayTotalsRow {
  /** Full task duration for the day (all completed entries). */
  totalSeconds: number;
  /** The row's shown to-send duration (0 when it cannot be exported). */
  toSendSeconds: number;
  /** True when the task/date already has finalized provenance. */
  isSent: boolean;
}

export interface RemoteSyncDayTotals {
  dayTotal: number;
  toSend: number;
}

/**
 * Day total includes every completed entry, regardless of export state.
 * To send sums the shown to-send durations of rows not sent yet, activity chosen
 * or not; Sent rows are already counted in the tracker's logs.
 */
export function computeRemoteSyncDayTotals(
  rows: readonly RemoteSyncDayTotalsRow[],
  untitledSeconds: number,
): RemoteSyncDayTotals {
  let dayTotal = Math.max(0, untitledSeconds);
  let toSend = 0;

  for (const row of rows) {
    dayTotal += Math.max(0, row.totalSeconds);
    if (!row.isSent) toSend += Math.max(0, row.toSendSeconds);
  }

  return { dayTotal, toSend };
}
