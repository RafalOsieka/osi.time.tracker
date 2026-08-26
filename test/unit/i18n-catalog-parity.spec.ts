import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';

type CatalogNode = string | { readonly [key: string]: CatalogNode };

function collectKeys(obj: { readonly [key: string]: CatalogNode }, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return value instanceof Object ? collectKeys(value, full) : [full];
  });
}

describe('i18n catalog parity', () => {
  it('en.json and pl.json have an identical key set', () => {
    const enKeys = collectKeys(en).sort();
    const plKeys = collectKeys(pl).sort();
    expect(plKeys).toEqual(enKeys);
  });
});
