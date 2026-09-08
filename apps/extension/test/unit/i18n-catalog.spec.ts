import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json' with { type: 'json' };
import pl from '../../src/i18n/pl.json' with { type: 'json' };

type Tree = { readonly [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : keys(value, path);
  });
}

describe('extension catalogs', () => {
  it('keeps English and Polish keys in parity', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort());
  });
});
