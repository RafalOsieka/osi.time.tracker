import en from './en.json' with { type: 'json' };
import pl from './pl.json' with { type: 'json' };

export type ExtensionLocale = 'en' | 'pl';

type MessageTree = {
  readonly [key: string]: string | MessageTree;
};

const catalogs: Record<ExtensionLocale, MessageTree> = {
  en,
  pl,
};

export function detectLocale(): ExtensionLocale {
  const language = globalThis.navigator?.language ?? 'en';
  return language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

function lookup(tree: MessageTree, key: string): string | undefined {
  let current: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Resolves a catalog key; English is the fallback for missing Polish entries. */
export function translate(locale: ExtensionLocale, key: string): string {
  return lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key;
}
