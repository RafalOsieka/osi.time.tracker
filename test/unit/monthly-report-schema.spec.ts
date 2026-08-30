import { describe, expect, it } from 'vitest';
import { monthlyReportQuerySchema } from '../../shared/types/report';
import { proxiedRemoteTimeLogsRangeSchema } from '../../shared/types/remote-export';

describe('monthlyReportQuerySchema', () => {
  it('accepts a valid calendar month', () => {
    expect(monthlyReportQuerySchema.parse({ month: '2026-08' })).toEqual({ month: '2026-08' });
  });

  it('accepts an omitted month', () => {
    expect(monthlyReportQuerySchema.parse({})).toEqual({});
  });

  it('rejects month 13', () => {
    const result = monthlyReportQuerySchema.safeParse({ month: '2026-13' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('error.reportMonthInvalid');
    }
  });

  it('rejects month 00', () => {
    const result = monthlyReportQuerySchema.safeParse({ month: '2026-00' });
    expect(result.success).toBe(false);
  });

  it('rejects garbage month values', () => {
    expect(monthlyReportQuerySchema.safeParse({ month: 'august' }).success).toBe(false);
    expect(monthlyReportQuerySchema.safeParse({ month: '26-08' }).success).toBe(false);
    expect(monthlyReportQuerySchema.safeParse({ month: '2026-8' }).success).toBe(false);
  });
});

describe('proxiedRemoteTimeLogsRangeSchema', () => {
  const trackerId = '01900000-0000-7000-8000-000000000001';

  it('accepts a valid inclusive range', () => {
    expect(
      proxiedRemoteTimeLogsRangeSchema.parse({
        trackerId,
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    ).toEqual({
      trackerId,
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('rejects an inverted range', () => {
    const result = proxiedRemoteTimeLogsRangeSchema.safeParse({
      trackerId,
      from: '2026-08-31',
      to: '2026-08-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('error.remoteSyncDateInvalid');
    }
  });

  it('rejects a missing tracker id', () => {
    expect(
      proxiedRemoteTimeLogsRangeSchema.safeParse({
        from: '2026-08-01',
        to: '2026-08-31',
      }).success,
    ).toBe(false);
  });
});
