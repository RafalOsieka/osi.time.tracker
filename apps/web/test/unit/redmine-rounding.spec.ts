import { describe, expect, it } from 'vitest';
import { applyRoundingRule } from '../../shared/utils/rounding';
import { redmineHoursToSeconds, secondsToRedmineHours } from '@osi/remote-trackers/redmine';

describe('Redmine hours and tracker rounding', () => {
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
