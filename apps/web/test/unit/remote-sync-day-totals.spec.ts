import { describe, expect, it } from 'vitest';
import {
  computeRemoteSyncDayTotals,
  type RemoteSyncDayTotalsRow,
} from '../../shared/utils/remote-sync-day-totals';

function row(
  partial: Partial<RemoteSyncDayTotalsRow> & Pick<RemoteSyncDayTotalsRow, 'totalSeconds'>,
): RemoteSyncDayTotalsRow {
  return {
    toSendSeconds: partial.toSendSeconds ?? 0,
    isSent: partial.isSent ?? false,
    ...partial,
    totalSeconds: partial.totalSeconds,
  };
}

describe('computeRemoteSyncDayTotals', () => {
  it('returns zeros for an empty day', () => {
    expect(computeRemoteSyncDayTotals([], 0)).toEqual({
      dayTotal: 0,
      toSend: 0,
    });
  });

  it('includes Ready, Sent, blocked and untitled time, sending only rows not sent yet', () => {
    expect(
      computeRemoteSyncDayTotals(
        [
          row({ totalSeconds: 3700, toSendSeconds: 4500 }),
          row({ totalSeconds: 5400, toSendSeconds: 3600, isSent: true }),
          row({ totalSeconds: 1200 }),
        ],
        300,
      ),
    ).toEqual({ dayTotal: 10600, toSend: 4500 });
  });
});
