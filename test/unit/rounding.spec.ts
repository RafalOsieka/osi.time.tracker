import { describe, expect, it } from 'vitest';
import { applyRoundingRule, roundingSuggestionsFor } from '../../shared/utils/rounding';

const m = (minutes: number) => minutes * 60;
const hms = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds;

describe('applyRoundingRule', () => {
  it('passes the total through unchanged for the none rule', () => {
    expect(applyRoundingRule(1234, 'none')).toBe(1234);
  });

  it('rounds up to the next 15-minute multiple', () => {
    expect(applyRoundingRule(m(50), 'up_15m')).toBe(m(60));
    expect(applyRoundingRule(m(1), 'up_15m')).toBe(m(15));
  });

  it('rounds up to the next 30-minute multiple', () => {
    expect(applyRoundingRule(m(31), 'up_30m')).toBe(m(60));
  });

  it('rounds up to the next 1-hour multiple', () => {
    expect(applyRoundingRule(m(61), 'up_1h')).toBe(hms(2, 0));
  });

  it('leaves an exact multiple unchanged for up_* rules', () => {
    expect(applyRoundingRule(m(30), 'up_15m')).toBe(m(30));
    expect(applyRoundingRule(m(60), 'up_30m')).toBe(m(60));
    expect(applyRoundingRule(hms(2, 0), 'up_1h')).toBe(hms(2, 0));
  });

  it('keeps 0 as 0 for every rule', () => {
    expect(applyRoundingRule(0, 'none')).toBe(0);
    expect(applyRoundingRule(0, 'up_15m')).toBe(0);
    expect(applyRoundingRule(0, 'up_30m')).toBe(0);
    expect(applyRoundingRule(0, 'up_1h')).toBe(0);
    expect(applyRoundingRule(0, 'nearest_15m')).toBe(0);
    expect(applyRoundingRule(0, 'nearest_30m')).toBe(0);
    expect(applyRoundingRule(0, 'nearest_1h')).toBe(0);
  });

  it('rounds a sub-minute sum up to the increment for up_*', () => {
    expect(applyRoundingRule(30, 'up_15m')).toBe(m(15));
  });

  // REQ-220 nearest family
  it('nearest_15m rounds down below the midpoint (1:03 → 1:00)', () => {
    expect(applyRoundingRule(hms(1, 3), 'nearest_15m')).toBe(hms(1, 0));
  });

  it('nearest_15m rounds up above the midpoint (1:11 → 1:15)', () => {
    expect(applyRoundingRule(hms(1, 11), 'nearest_15m')).toBe(hms(1, 15));
  });

  it('nearest_15m half-up at the midpoint (1:07:30 → 1:15)', () => {
    expect(applyRoundingRule(hms(1, 7, 30), 'nearest_15m')).toBe(hms(1, 15));
  });

  it('nearest_* leaves exact multiples unchanged', () => {
    expect(applyRoundingRule(m(30), 'nearest_15m')).toBe(m(30));
    expect(applyRoundingRule(m(60), 'nearest_30m')).toBe(m(60));
    expect(applyRoundingRule(hms(2, 0), 'nearest_1h')).toBe(hms(2, 0));
  });

  it('nearest_30m and nearest_1h round to their increments', () => {
    // 14m < half of 30m → would be 0 → zero guard lifts to 30m
    expect(applyRoundingRule(m(14), 'nearest_30m')).toBe(m(30));
    expect(applyRoundingRule(m(16), 'nearest_30m')).toBe(m(30));
    // 29m < half of 1h → would be 0 → zero guard lifts to 1h
    expect(applyRoundingRule(m(29), 'nearest_1h')).toBe(hms(1, 0));
    expect(applyRoundingRule(m(31), 'nearest_1h')).toBe(hms(1, 0));
    expect(applyRoundingRule(hms(1, 20), 'nearest_1h')).toBe(hms(1, 0));
    expect(applyRoundingRule(hms(1, 40), 'nearest_1h')).toBe(hms(2, 0));
  });

  // REQ-221 never-round-to-zero
  it('lifts a short non-zero total to one increment under nearest_15m (0:04 → 0:15)', () => {
    expect(applyRoundingRule(m(4), 'nearest_15m')).toBe(m(15));
  });

  it('lifts a short non-zero total under up_* as well (already ceil, regression)', () => {
    expect(applyRoundingRule(m(4), 'up_15m')).toBe(m(15));
    expect(applyRoundingRule(m(4), 'up_30m')).toBe(m(30));
    expect(applyRoundingRule(m(4), 'up_1h')).toBe(hms(1, 0));
  });

  it('passthrough none is unaffected by the zero guard', () => {
    expect(applyRoundingRule(m(4), 'none')).toBe(m(4));
  });

  it('existing up_15m behaviour is unchanged for 1:03 → 1:15', () => {
    expect(applyRoundingRule(hms(1, 3), 'up_15m')).toBe(hms(1, 15));
  });
});

describe('roundingSuggestionsFor', () => {
  it('offers only the exact total for the none rule', () => {
    expect(roundingSuggestionsFor(hms(1, 3), 'none')).toEqual([
      { kind: 'exact', seconds: hms(1, 3) },
    ]);
  });

  it('offers exact, floor and ceil under nearest_15m for 1:03', () => {
    expect(roundingSuggestionsFor(hms(1, 3), 'nearest_15m')).toEqual([
      { kind: 'exact', seconds: hms(1, 3) },
      { kind: 'floor', seconds: hms(1, 0) },
      { kind: 'ceil', seconds: hms(1, 15) },
    ]);
  });

  it('de-duplicates when the total is an exact multiple', () => {
    expect(roundingSuggestionsFor(hms(1, 0), 'nearest_15m')).toEqual([
      { kind: 'exact', seconds: hms(1, 0) },
    ]);
  });

  it('offers floor 0 and ceil one increment for a sub-increment total', () => {
    expect(roundingSuggestionsFor(m(4), 'up_15m')).toEqual([
      { kind: 'exact', seconds: m(4) },
      { kind: 'floor', seconds: 0 },
      { kind: 'ceil', seconds: m(15) },
    ]);
  });

  it('works for nearest_30m and up_1h increments', () => {
    expect(roundingSuggestionsFor(m(40), 'nearest_30m')).toEqual([
      { kind: 'exact', seconds: m(40) },
      { kind: 'floor', seconds: m(30) },
      { kind: 'ceil', seconds: m(60) },
    ]);
    expect(roundingSuggestionsFor(hms(1, 20), 'up_1h')).toEqual([
      { kind: 'exact', seconds: hms(1, 20) },
      { kind: 'floor', seconds: hms(1, 0) },
      { kind: 'ceil', seconds: hms(2, 0) },
    ]);
  });
});
