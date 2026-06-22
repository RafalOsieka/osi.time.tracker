import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? collectKeys(value as Record<string, unknown>, full)
      : [full];
  });
}

describe('i18n catalog parity', () => {
  it('en.json and pl.json have an identical key set', () => {
    const enKeys = collectKeys(en).sort();
    const plKeys = collectKeys(pl).sort();
    expect(plKeys).toEqual(enKeys);
  });
});
