import { describe, expect, it } from 'vitest';
import { formatReportDuration } from '../../app/utils/format-report-duration';

describe('formatReportDuration', () => {
  it('formats hours without padding', () => {
    expect(formatReportDuration(8 * 3600)).toBe('8:00');
  });

  it('formats zero', () => {
    expect(formatReportDuration(0)).toBe('0:00');
  });

  it('formats two-digit hours', () => {
    expect(formatReportDuration(10 * 3600 + 5 * 60)).toBe('10:05');
  });

  it('floors leftover seconds', () => {
    expect(formatReportDuration(7 * 3600 + 50 * 60 + 59)).toBe('7:50');
  });
});
