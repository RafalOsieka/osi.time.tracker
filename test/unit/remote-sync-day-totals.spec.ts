import { describe, expect, it } from 'vitest';
import {
  computeRemoteSyncDayTotals,
  type RemoteSyncDayTotalsRow,
} from '../../shared/utils/remote-sync-day-totals';

function row(
  partial: Partial<RemoteSyncDayTotalsRow> & Pick<RemoteSyncDayTotalsRow, 'totalSeconds'>,
): RemoteSyncDayTotalsRow {
  return {
    selectedSeconds: partial.selectedSeconds ?? partial.totalSeconds,
    exportSeconds: partial.exportSeconds ?? partial.totalSeconds,
    isPushable: partial.isPushable ?? false,
    isIncluded: partial.isIncluded ?? false,
    ...partial,
    totalSeconds: partial.totalSeconds,
  };
}

describe('computeRemoteSyncDayTotals', () => {
  it('returns zeros for an empty day', () => {
    expect(computeRemoteSyncDayTotals([], 0)).toEqual({
      dayTotal: 0,
      tracked: 0,
      toSend: 0,
      blocked: 0,
      excluded: 0,
      untitled: 0,
      delta: 0,
    });
  });

  it('handles an untitled-only day', () => {
    const totals = computeRemoteSyncDayTotals([], 900);
    expect(totals).toEqual({
      dayTotal: 900,
      tracked: 0,
      toSend: 0,
      blocked: 0,
      excluded: 0,
      untitled: 900,
      delta: 0,
    });
    expect(totals.dayTotal).toBe(
      totals.tracked + totals.blocked + totals.excluded + totals.untitled,
    );
  });

  it('holds the dayTotal = tracked + blocked + excluded + untitled invariant', () => {
    const totals = computeRemoteSyncDayTotals(
      [
        row({
          totalSeconds: 3600,
          selectedSeconds: 3600,
          exportSeconds: 3600,
          isPushable: true,
          isIncluded: true,
        }),
        row({
          totalSeconds: 1800,
          selectedSeconds: 1800,
          exportSeconds: 1800,
          isPushable: false,
          isIncluded: true,
        }),
        row({
          totalSeconds: 600,
          selectedSeconds: 0,
          exportSeconds: 0,
          isPushable: false,
          isIncluded: false,
        }),
      ],
      300,
    );

    expect(totals.dayTotal).toBe(3600 + 1800 + 600 + 300);
    expect(totals.tracked).toBe(3600);
    expect(totals.toSend).toBe(3600);
    expect(totals.blocked).toBe(1800);
    expect(totals.excluded).toBe(600);
    expect(totals.untitled).toBe(300);
    expect(totals.dayTotal).toBe(
      totals.tracked + totals.blocked + totals.excluded + totals.untitled,
    );
  });

  it('reports a positive delta when rounding increases export duration', () => {
    const totals = computeRemoteSyncDayTotals(
      [
        row({
          totalSeconds: 3700,
          selectedSeconds: 3700,
          exportSeconds: 4500,
          isPushable: true,
          isIncluded: true,
        }),
      ],
      0,
    );
    expect(totals.tracked).toBe(3700);
    expect(totals.toSend).toBe(4500);
    expect(totals.delta).toBe(800);
  });

  it('reports a negative delta when export duration is below tracked', () => {
    const totals = computeRemoteSyncDayTotals(
      [
        row({
          totalSeconds: 3600,
          selectedSeconds: 3600,
          exportSeconds: 2700,
          isPushable: true,
          isIncluded: true,
        }),
      ],
      0,
    );
    expect(totals.tracked).toBe(3600);
    expect(totals.toSend).toBe(2700);
    expect(totals.delta).toBe(-900);
  });

  it('counts included-but-blocked rows in blocked, not tracked or toSend', () => {
    const totals = computeRemoteSyncDayTotals(
      [
        row({
          totalSeconds: 1200,
          selectedSeconds: 1200,
          exportSeconds: 1200,
          isPushable: false,
          isIncluded: true,
        }),
      ],
      0,
    );
    expect(totals.tracked).toBe(0);
    expect(totals.toSend).toBe(0);
    expect(totals.blocked).toBe(1200);
    expect(totals.excluded).toBe(0);
    expect(totals.dayTotal).toBe(
      totals.tracked + totals.blocked + totals.excluded + totals.untitled,
    );
  });

  it('counts partially selected blocked rows with remainder as excluded', () => {
    const totals = computeRemoteSyncDayTotals(
      [
        row({
          totalSeconds: 1000,
          selectedSeconds: 400,
          exportSeconds: 400,
          isPushable: false,
          isIncluded: true,
        }),
      ],
      0,
    );
    expect(totals.blocked).toBe(400);
    expect(totals.excluded).toBe(600);
    expect(totals.dayTotal).toBe(
      totals.tracked + totals.blocked + totals.excluded + totals.untitled,
    );
  });
});
