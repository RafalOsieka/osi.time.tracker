import { describe, expect, it } from 'vitest';
import { attentionReasons } from '../../shared/utils/monthly-report-attention';

describe('attentionReasons', () => {
  it('flags Direct hours', () => {
    expect(
      attentionReasons({
        localSeconds: 3600,
        trackers: [{ appSeconds: 3600, directSeconds: 1800, fetchFailed: false }],
      }),
    ).toContain('direct');
  });

  it('flags unexported local hours when every tracker fetched zero', () => {
    expect(
      attentionReasons({
        localSeconds: 8 * 3600,
        trackers: [{ appSeconds: 0, directSeconds: 0, fetchFailed: false }],
      }),
    ).toEqual(['unexported']);
  });

  it('flags unexported when the user has no trackers', () => {
    expect(attentionReasons({ localSeconds: 3600, trackers: [] })).toEqual(['unexported']);
  });

  it('does not treat a fetch failure as unexported', () => {
    expect(
      attentionReasons({
        localSeconds: 8 * 3600,
        trackers: [{ appSeconds: 0, directSeconds: 0, fetchFailed: true }],
      }),
    ).toEqual(['fetchFailed']);
  });

  it('flags remote-only days', () => {
    expect(
      attentionReasons({
        localSeconds: 0,
        trackers: [{ appSeconds: 0, directSeconds: 7200, fetchFailed: false }],
      }),
    ).toEqual(['direct', 'remoteOnly']);
  });

  it('does not flag a rounding-only Local vs App difference', () => {
    expect(
      attentionReasons({
        localSeconds: 7 * 3600 + 50 * 60,
        trackers: [{ appSeconds: 8 * 3600, directSeconds: 0, fetchFailed: false }],
      }),
    ).toEqual([]);
  });
});
