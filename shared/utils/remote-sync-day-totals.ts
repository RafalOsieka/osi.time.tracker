/**
 * Input row for day-total derivation. Predicates and durations are injected
 * by the page so this stays a pure, unit-testable reconciliation.
 */
export interface RemoteSyncDayTotalsRow {
  /** Full task duration for the day (all completed entries). */
  totalSeconds: number;
  /** Duration of currently selected entries. */
  selectedSeconds: number;
  /** Export duration after rounding/overrides (0 when excluded by duration). */
  exportSeconds: number;
  /** True when the row will actually be pushed. */
  isPushable: boolean;
  /**
   * True when the user intends the row to be part of the export
   * (has selected entries / is "included"). A row can be included but not
   * pushable (blocked) — those seconds land in `blocked`, not `tracked`.
   */
  isIncluded: boolean;
}

export interface RemoteSyncDayTotals {
  dayTotal: number;
  tracked: number;
  toSend: number;
  blocked: number;
  excluded: number;
  untitled: number;
  /** Signed difference `toSend - tracked`. */
  delta: number;
}

/**
 * Computes the three reconciling day summaries plus blocked/excluded/untitled
 * amounts. Invariant: `dayTotal = tracked + blocked + excluded + untitled`.
 *
 * - **day total**: every completed entry on the day (incl. untitled / blocked)
 * - **tracked**: selected seconds of pushable rows only
 * - **to send**: export durations of pushable rows only
 * - **blocked**: selected (or full) seconds of included-but-not-pushable rows
 * - **excluded**: seconds of exportable rows the user deselected
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
  let excluded = 0;

  for (const row of rows) {
    const total = Math.max(0, row.totalSeconds);
    dayTotal += total;

    if (row.isPushable) {
      const selected = Math.max(0, row.selectedSeconds);
      tracked += selected;
      toSend += Math.max(0, row.exportSeconds);
      // Deselected remainder of an otherwise pushable row is excluded time.
      const remainder = total - selected;
      if (remainder > 0) {
        excluded += remainder;
      }
      continue;
    }

    if (row.isIncluded) {
      // Included but not pushable → blocked. Prefer selected seconds when the
      // user narrowed the selection; fall back to the full row total.
      const blockedSeconds = row.selectedSeconds > 0 ? Math.max(0, row.selectedSeconds) : total;
      blocked += blockedSeconds;
      // Any deselected remainder still contributes to the day total and is
      // counted as excluded so the identity holds.
      const remainder = total - blockedSeconds;
      if (remainder > 0) {
        excluded += remainder;
      }
      continue;
    }

    // Fully excluded (no selection / user opted out / export duration 0).
    excluded += total;
  }

  const untitled = Math.max(0, untitledSeconds);

  return {
    dayTotal,
    tracked,
    toSend,
    blocked,
    excluded,
    untitled,
    delta: toSend - tracked,
  };
}
