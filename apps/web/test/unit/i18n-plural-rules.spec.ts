import { describe, expect, it } from 'vitest';
import { polishPluralRule } from '../../i18n/plural-rules';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';

function applyPipePlural(
  message: string,
  index: number,
  vars: Record<string, string | number>,
): string {
  const parts = message.split(/\s*\|\s*/);
  const chosen = parts[index] ?? parts[parts.length - 1] ?? '';
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    chosen,
  );
}

describe('polishPluralRule', () => {
  it('maps one / few / many to choice indexes', () => {
    expect(polishPluralRule(1, 3)).toBe(0);
    expect(polishPluralRule(2, 3)).toBe(1);
    expect(polishPluralRule(3, 3)).toBe(1);
    expect(polishPluralRule(4, 3)).toBe(1);
    expect(polishPluralRule(5, 3)).toBe(2);
    expect(polishPluralRule(0, 3)).toBe(2);
    expect(polishPluralRule(12, 3)).toBe(2);
    expect(polishPluralRule(22, 3)).toBe(1);
    expect(polishPluralRule(25, 3)).toBe(2);
  });
});

describe('count-sensitive catalogs', () => {
  it('declines remote issue result counts', () => {
    expect(applyPipePlural(en.remoteIssuePicker.resultCount, 0, { count: 1 })).toBe(
      '1 result found',
    );
    expect(applyPipePlural(en.remoteIssuePicker.resultCount, 1, { count: 3 })).toBe(
      '3 results found',
    );
    expect(
      applyPipePlural(pl.remoteIssuePicker.resultCount, polishPluralRule(1, 3), { count: 1 }),
    ).toBe('Znaleziono 1 wynik');
    expect(
      applyPipePlural(pl.remoteIssuePicker.resultCount, polishPluralRule(3, 3), { count: 3 }),
    ).toBe('Znaleziono 3 wyniki');
    expect(
      applyPipePlural(pl.remoteIssuePicker.resultCount, polishPluralRule(5, 3), { count: 5 }),
    ).toBe('Znaleziono 5 wyników');
    expect(
      applyPipePlural(pl.remoteIssuePicker.resultCount, polishPluralRule(22, 3), { count: 22 }),
    ).toBe('Znaleziono 22 wyniki');
    expect(
      applyPipePlural(pl.remoteIssuePicker.resultCount, polishPluralRule(25, 3), { count: 25 }),
    ).toBe('Znaleziono 25 wyników');
  });

  it('declines timer-view entry counts', () => {
    expect(applyPipePlural(en.timerView.entryCount, 0, { count: 1 })).toBe('1 entry');
    expect(applyPipePlural(en.timerView.entryCount, 1, { count: 3 })).toBe('3 entries');
    expect(applyPipePlural(pl.timerView.entryCount, polishPluralRule(1, 3), { count: 1 })).toBe(
      '1 wpis',
    );
    expect(applyPipePlural(pl.timerView.entryCount, polishPluralRule(3, 3), { count: 3 })).toBe(
      '3 wpisy',
    );
    expect(applyPipePlural(pl.timerView.entryCount, polishPluralRule(5, 3), { count: 5 })).toBe(
      '5 wpisów',
    );
    expect(applyPipePlural(pl.timerView.entryCount, polishPluralRule(22, 3), { count: 22 })).toBe(
      '22 wpisy',
    );
  });

  it('declines export progress against the total task count', () => {
    expect(
      applyPipePlural(en.remoteSync.exportDialog.progress, 0, { completed: 1, total: 1 }),
    ).toBe('1 of 1 task complete');
    expect(
      applyPipePlural(en.remoteSync.exportDialog.progress, 1, { completed: 2, total: 3 }),
    ).toBe('2 of 3 tasks complete');
    expect(
      applyPipePlural(pl.remoteSync.exportDialog.progress, polishPluralRule(1, 3), {
        completed: 1,
        total: 1,
      }),
    ).toBe('1 z 1 zadania ukończonego');
    expect(
      applyPipePlural(pl.remoteSync.exportDialog.progress, polishPluralRule(3, 3), {
        completed: 2,
        total: 3,
      }),
    ).toBe('2 z 3 zadań ukończonych');
    expect(
      applyPipePlural(pl.remoteSync.exportDialog.progress, polishPluralRule(5, 3), {
        completed: 5,
        total: 5,
      }),
    ).toBe('5 z 5 zadań ukończonych');
  });
});
