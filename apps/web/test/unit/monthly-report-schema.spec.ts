import { describe, expect, it } from 'vitest';
import { monthlyReportQuerySchema } from '../../shared/types/report';

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
