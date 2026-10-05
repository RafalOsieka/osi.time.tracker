import { describe, expect, it } from 'vite-plus/test';
import { formatActivity, relativeTime } from '../../src/activity/format-activity.js';
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

  it('names the operation and outcome in the selected language', () => {
    const t = (key: string) => translate('pl', key);
    expect(
      formatActivity(
        { at: '2026-10-05T11:00:00.000Z', operation: 'fetchTimeLogs', outcome: 'timeout' },
        now,
        'pl',
        t,
      ),
    ).toBe('1 godzinę temu · Pobranie wpisów czasu · Przekroczony czas');
    expect(formatActivity(undefined, now, 'pl', t)).toBe('Brak aktywności');
  });
});
