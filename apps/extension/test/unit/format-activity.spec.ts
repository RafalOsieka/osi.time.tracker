import { describe, expect, it } from 'vite-plus/test';
import { relativeTime, summarizeActivity } from '../../src/activity/format-activity.js';
import { translate } from '../../src/i18n/translate.js';

const now = Date.parse('2026-10-05T12:00:00.000Z');

describe('activity formatting', () => {
  it.each([
    ['2026-10-05T11:59:50.000Z', 'now'],
    ['2026-10-05T11:55:00.000Z', '5 minutes ago'],
    ['2026-10-05T09:00:00.000Z', '3 hours ago'],
    ['2026-10-04T12:00:00.000Z', 'yesterday'],
  ])('describes %s relative to now', (at, expected) => {
    expect(relativeTime(at, now, 'en')).toBe(expected);
  });

  it('names the outcome apart from the operation and its time, in the selected language', () => {
    const t = (key: string) => translate('pl', key);
    expect(
      summarizeActivity(
        { at: '2026-10-05T11:00:00.000Z', operation: 'fetchTimeLogs', outcome: 'timeout' },
        now,
        'pl',
        t,
      ),
    ).toEqual({
      ok: false,
      outcome: 'Przekroczony czas',
      operation: 'Pobranie wpisów czasu',
      failure: 'Nieudane pobranie wpisów czasu',
      when: '1 godzinę temu',
    });
    expect(
      summarizeActivity(
        { at: '2026-10-05T11:58:00.000Z', operation: 'createTimeEntry', outcome: 'ok' },
        now,
        'pl',
        t,
      ),
    ).toMatchObject({ ok: true, outcome: 'Powodzenie' });
  });
});

describe('compact activity', () => {
  it('keeps the shared failure phrase and takes the short time in the popup', () => {
    const t = (key: string) => translate('pl', key);
    const summary = summarizeActivity(
      { at: '2026-10-05T11:40:00.000Z', operation: 'createTimeEntry', outcome: 'timeout' },
      now,
      'pl',
      t,
      true,
    );
    expect(summary.failure).toBe('Nieudany eksport wpisu czasu');
    expect(summary.when).toBe('20\u00a0min\u00a0temu');
  });
});
