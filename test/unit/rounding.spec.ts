import { describe, expect, it } from 'vitest';
import { applyRoundingRule } from '../../shared/utils/rounding';

describe('applyRoundingRule', () => {
  it('passes the total through unchanged for the none rule', () => {
    expect(applyRoundingRule(1234, 'none')).toBe(1234);
  });

  it('rounds up to the next 15-minute multiple', () => {
    expect(applyRoundingRule(50 * 60, 'up_15m')).toBe(60 * 60);
    expect(applyRoundingRule(1 * 60, 'up_15m')).toBe(15 * 60);
  });

  it('rounds up to the next 30-minute multiple', () => {
    expect(applyRoundingRule(31 * 60, 'up_30m')).toBe(60 * 60);
  });

  it('rounds up to the next 1-hour multiple', () => {
    expect(applyRoundingRule(61 * 60, 'up_1h')).toBe(2 * 60 * 60);
  });

  it('leaves an exact multiple unchanged', () => {
    expect(applyRoundingRule(30 * 60, 'up_15m')).toBe(30 * 60);
    expect(applyRoundingRule(60 * 60, 'up_30m')).toBe(60 * 60);
    expect(applyRoundingRule(2 * 60 * 60, 'up_1h')).toBe(2 * 60 * 60);
  });

  it('keeps 0 as 0 for every rule', () => {
    expect(applyRoundingRule(0, 'none')).toBe(0);
    expect(applyRoundingRule(0, 'up_15m')).toBe(0);
    expect(applyRoundingRule(0, 'up_30m')).toBe(0);
    expect(applyRoundingRule(0, 'up_1h')).toBe(0);
  });

  it('rounds a sub-minute sum up to the increment', () => {
    expect(applyRoundingRule(30, 'up_15m')).toBe(15 * 60);
  });
});
