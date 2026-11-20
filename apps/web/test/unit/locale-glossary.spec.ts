import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import extensionPl from '../../../extension/src/i18n/pl.json';
import webPl from '../../i18n/locales/pl.json';

// The Polish UI names domain concepts only with GLOSSARY.md's `_Polish_` words, never with a
// word from a term's `_Polish avoid_` list (docs/agents/domain.md). The glossary is the only
// source: this test reads both lists from it. Entries with a parenthetical condition, such as
// "Wpis (on its own)", need judgement and are left to review, as is a canonical word used for
// the wrong concept ("Zadanie" for a Remote issue).

type CatalogNode = string | { readonly [key: string]: CatalogNode };

const glossary = readFileSync(new URL('../../../../GLOSSARY.md', import.meta.url), 'utf8');

function glossaryLines(label: string): string[] {
  return [...glossary.matchAll(new RegExp(`^${label}: (.+)$`, 'gm'))].map(([, list]) => list ?? '');
}

// Every canonical Polish name, e.g. "Aktywny wpis czasu". Lowercase pieces are notes
// ("verb: połączyć", "a term for code and docs only"), not names.
const canonical = glossaryLines('_Polish_')
  .flatMap((line) => line.split(/[(),;]/))
  .map((name) => name.trim())
  .filter((name) => /^\p{Lu}/u.test(name))
  .toSorted((a, b) => b.length - a.length);

const avoided = [
  ...new Set(
    glossaryLines('_Polish avoid_')
      .flatMap((line) => line.split(','))
      .map((word) => word.trim())
      .filter((word) => !word.includes('('))
      .map((word) => word.toLowerCase()),
  ),
];

// A word in any inflected form: its stem (without a final vowel) plus up to three letters,
// so "witryna" also catches "witryny" and "witrynę".
function inflected(word: string): string {
  const stem = word.length > 4 && /[aeiouyąęóć]$/u.test(word) ? word.slice(0, -1) : word;
  return `${stem}\\p{L}{0,3}`;
}

function phrase(words: string): RegExp {
  const pattern = words.split(/\s+/).map(inflected).join('\\s+');
  return new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, 'giu');
}

// Avoided words a message uses in their plain, non-domain sense, as "<message>: <word>".
const WEB_PLAIN_SENSE = new Set([
  'auth.passwordLabel: hasło', // the login password
  'auth.showPassword: hasło',
  'errors.auth.credentialsRequired: hasło',
  'trackers.secretHelp: serwer', // OSI's own server
  'trackerImport.unscopedHelp: strona', // a page of the app
  'clientReport.contractorDetailsHelp: strona', // a page of the PDF
  'clientReport.missingSecret: strona',
  'clientReport.pdf.pageOf: strona',
  'error.exportRecoveryUnavailable: strona',
  'error.extensionIncompatible: strona',
]);

const EXTENSION_PLAIN_SENSE = new Set([
  'app.checklistOfferHelp: strona', // the extension's setup page
  'app.currentWebsiteHelp: strona',
  'app.checklistActionHelp: strona',
  'approvals.invalidWebsiteCredentials: hasło', // credentials inside an address
  'approvals.destinationsActivityNote: aktywność', // the extension's operation history
  'activity.none: aktywność',
  'activity.label: aktywność',
]);

function messages(catalog: CatalogNode, prefix = ''): [path: string, text: string][] {
  return catalog instanceof Object
    ? Object.entries(catalog).flatMap(([key, entry]) =>
        messages(entry, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, catalog]];
}

// Every avoided word in a catalog, as "<message>: <word>", once canonical names are blanked out.
function slips(catalog: CatalogNode, plainSense: ReadonlySet<string>): string[] {
  return messages(catalog).flatMap(([path, text]) => {
    const rest = canonical.reduce((masked, name) => masked.replace(phrase(name), ' '), text);
    return avoided
      .filter((word) => phrase(word).test(rest))
      .map((word) => `${path}: ${word}`)
      .filter((slip) => !plainSense.has(slip));
  });
}

describe('Polish catalogs against GLOSSARY.md', () => {
  it('reads both lists from the glossary', () => {
    expect(canonical).toContain('Aktywny wpis czasu');
    expect(avoided).toContain('witryna');
  });

  // Canonical names are blanked out before the check, so an avoided word that is also another
  // term's canonical name could never be reported.
  it('avoids no word that is another term’s canonical name', () => {
    const names = new Set(canonical.map((name) => name.toLowerCase()));
    expect(avoided.filter((word) => names.has(word))).toEqual([]);
  });

  it('the web app uses no avoided word for a domain concept', () => {
    expect(slips(webPl, WEB_PLAIN_SENSE)).toEqual([]);
  });

  it('the extension uses no avoided word for a domain concept', () => {
    expect(slips(extensionPl, EXTENSION_PLAIN_SENSE)).toEqual([]);
  });
});
