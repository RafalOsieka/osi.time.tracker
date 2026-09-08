import en from './en.json' with { type: 'json' };
import pl from './pl.json' with { type: 'json' };

export type ExtensionLocale = 'en' | 'pl';

const catalogs = { en, pl };

function pick(
  group: typeof en.app | typeof en.approvals | typeof en.error,
  name: string,
): string | undefined {
  for (const [entryName, value] of Object.entries(group)) {
    if (entryName === name) return value;
  }
  return undefined;
}

function readMessage(catalog: typeof en, key: string): string | undefined {
  const separator = key.indexOf('.');
  if (separator <= 0 || key.includes('.', separator + 1)) return undefined;
  const group = key.slice(0, separator);
  const name = key.slice(separator + 1);
  if (group === 'app') return pick(catalog.app, name);
  if (group === 'approvals') return pick(catalog.approvals, name);
  if (group === 'error') return pick(catalog.error, name);
  return undefined;
}

export function detectLocale(): ExtensionLocale {
  const language = globalThis.navigator?.language ?? 'en';
  return language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

/** Resolves a catalog key; English is the fallback for missing Polish entries. */
export function translate(locale: ExtensionLocale, key: string): string {
  return readMessage(catalogs[locale], key) ?? readMessage(catalogs.en, key) ?? key;
}
