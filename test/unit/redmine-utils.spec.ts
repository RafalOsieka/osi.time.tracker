import { describe, expect, it } from 'vitest';
import { applyRoundingRule } from '../../shared/utils/rounding';
import {
  redmineAuthHeaders,
  redmineHoursToSeconds,
  secondsToRedmineHours,
} from '../../shared/remote/redmine/utils';

describe('secondsToRedmineHours', () => {
  it('converts whole hours at 0.01 h precision', () => {
    expect(secondsToRedmineHours(3600)).toBe(1);
  });

  it('converts 15 minutes to 0.25 h', () => {
    expect(secondsToRedmineHours(900)).toBe(0.25);
  });

  it('converts 36 seconds to 0.01 h', () => {
    expect(secondsToRedmineHours(36)).toBe(0.01);
  });

  it('rounds half-up at the 0.01 h boundary', () => {
    // 18 s is exactly halfway to 0.01 h → rounds to 0.01
    expect(secondsToRedmineHours(18)).toBe(0.01);
    expect(secondsToRedmineHours(17)).toBe(0);
  });
});

describe('redmineHoursToSeconds', () => {
  it('converts decimal hours back to whole seconds', () => {
    expect(redmineHoursToSeconds(1)).toBe(3600);
    expect(redmineHoursToSeconds(0.25)).toBe(900);
    expect(redmineHoursToSeconds(0.01)).toBe(36);
  });
});

describe('Redmine hours round-trip', () => {
  it('is stable at 0.01 h granularity', () => {
    for (const hours of [0.01, 0.25, 0.5, 1, 1.75, 8.33]) {
      const seconds = redmineHoursToSeconds(hours);
      expect(secondsToRedmineHours(seconds)).toBe(hours);
    }
  });

  it('is lossless for all up_* rounding rules', () => {
    const samples = [1, 60, 500, 899, 900, 1800, 3599, 3600, 7201];
    for (const rule of ['up_15m', 'up_30m', 'up_1h'] as const) {
      for (const raw of samples) {
        const rounded = applyRoundingRule(raw, rule);
        const hours = secondsToRedmineHours(rounded);
        expect(redmineHoursToSeconds(hours)).toBe(rounded);
      }
    }
  });
});

describe('redmineAuthHeaders', () => {
  it('returns the X-Redmine-API-Key header when a secret is provided', () => {
    expect(redmineAuthHeaders('my-api-key')).toEqual({ 'X-Redmine-API-Key': 'my-api-key' });
  });

  it('returns undefined when no secret is provided', () => {
    expect(redmineAuthHeaders(null)).toBeUndefined();
  });
});
