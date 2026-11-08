import { describe, expect, it } from 'vite-plus/test';
import { translate } from '../../src/i18n/translate.js';
import { missingAccessAlert } from '../../src/ui/alerts.js';
import { extensionStatus, missingAccessItems } from '../../src/ui/extension-status.js';

const working = { failed: false, missingAccess: 0, pendingSuggestions: 0, setupComplete: true };

describe('popup status', () => {
  it.each([
    ['ready once set up with nothing waiting', working, 'ready'],
    [
      'setup on a fresh install or with only a website',
      { ...working, setupComplete: false },
      'setup',
    ],
    ['review while suggestions wait', { ...working, pendingSuggestions: 2 }, 'review'],
    [
      'review even before setup is complete',
      { ...working, setupComplete: false, pendingSuggestions: 1 },
      'review',
    ],
    [
      'access when an approval lost it',
      { ...working, missingAccess: 1, pendingSuggestions: 2 },
      'access',
    ],
    ['error when settings cannot be read', { ...working, failed: true, missingAccess: 1 }, 'error'],
  ] as const)('is %s', (_name, state, expected) => {
    expect(extensionStatus(state)).toBe(expected);
  });
});

describe('missing access', () => {
  const website = 'https://time.example.com';
  const tracker = {
    websiteOrigin: website,
    provider: 'redmine' as const,
    origin: 'https://redmine.example.com',
    basePath: '/team',
  };
  const t = (key: string, params?: Readonly<Record<string, string | number>>) =>
    translate('en', key, params);

  it('names the tracker that lost access and the control that restores it', () => {
    const items = missingAccessItems([{ origin: website }], [tracker], [tracker.origin]);
    expect(items).toEqual([
      {
        kind: 'tracker',
        name: 'redmine.example.com/team',
        focus: `destination-${website}|redmine|https://redmine.example.com/team`,
        approval: tracker,
      },
    ]);
    expect(missingAccessAlert(items, 'popup', t)?.title).toBe(
      'No access to redmine.example.com/team',
    );
  });

  it('lists every affected address when several lost access', () => {
    const items = missingAccessItems([{ origin: website }], [tracker], [website, tracker.origin]);
    expect(items.map((item) => item.kind)).toEqual(['website', 'tracker']);
    expect(missingAccessAlert(items, 'setup', t)?.description).toContain(
      'time.example.com, redmine.example.com/team',
    );
  });

  it('raises no alert while everything has access', () => {
    expect(
      missingAccessAlert(missingAccessItems([{ origin: website }], [tracker], []), 'popup', t),
    ).toBeNull();
  });
});
