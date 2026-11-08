// Every screen of the browser extension the capture can take (`capture-extension.ts`): its toolbar
// popup and its setup page, each in the states a user meets. A screen puts the extension into its
// state by writing the extension's own storage, the way the extension writes it; nothing in the
// extension is changed. The data matches the app's seed (`seed.ts`): the user's OSI Time Tracker
// website and the two Trackers, Acme OpenProject and Globex Redmine.
import type { Page } from 'playwright';
import { z } from 'zod';
import { TRACKERS } from './seed.js';

/** The user's self-hosted OSI Time Tracker website. */
export const WEBSITE = 'https://time.kowalska.example';

// The storage shapes, as `apps/extension/src/approvals/chrome-store.ts`, `suggestions` and
// `activity` define them. The extension drops anything that does not parse, so a screen whose data
// drifted from these shapes shows empty lists and never reaches its `ready` selectors.
const destinationSchema = z.object({
  websiteOrigin: z.url(),
  provider: z.enum(['openproject', 'redmine']),
  origin: z.url(),
  basePath: z.string(),
});
type Destination = z.infer<typeof destinationSchema>;

const approvalsSchema = z.object({
  websites: z.array(z.object({ origin: z.url() })),
  destinations: z.array(destinationSchema),
});

const suggestionsSchema = z.array(destinationSchema.extend({ suggestedAt: z.iso.datetime() }));

const activitySchema = z.record(
  z.string(),
  z.object({
    at: z.iso.datetime(),
    operation: z.enum(['searchIssues', 'fetchTimeLogs', 'createTimeEntry']),
    outcome: z.enum(['ok', 'permission', 'timeout']),
  }),
);

export const extensionStateSchema = z.object({
  approvals: approvalsSchema,
  suggestions: suggestionsSchema,
  activity: activitySchema,
});
/** What the extension holds: approvals and suggestions in local storage, activity in session. */
export type ExtensionState = z.infer<typeof extensionStateSchema>;

/** The extension's storage keys for each part of the state. */
export const STORAGE_KEYS = {
  approvals: 'osi.approvals',
  suggestions: 'osi.suggestions',
  activity: 'osi.activity',
} as const satisfies Record<keyof ExtensionState, string>;

/** A Tracker from the seed as the extension stores its destination: origin plus base path. */
function destination(provider: Destination['provider'], baseUrl: string): Destination {
  const url = new URL(baseUrl);
  return {
    websiteOrigin: WEBSITE,
    provider,
    origin: url.origin,
    basePath: url.pathname === '/' ? '' : url.pathname,
  };
}

const ACME = destination(TRACKERS.acme.systemType, TRACKERS.acme.baseUrl);
const GLOBEX = destination(TRACKERS.globex.systemType, TRACKERS.globex.baseUrl);
/** Trackers an approved website asked the extension to approve; one on plain HTTP. */
const INITECH_OPENPROJECT = destination('openproject', 'https://op.initech.example');
const INITECH_REDMINE = destination('redmine', 'http://tracker.initech.example/redmine');

/** The extension's id of a destination or suggestion (`destinationKey`). */
export function destinationKey(item: Destination): string {
  return `${item.websiteOrigin}|${item.provider}|${item.origin}${item.basePath}`;
}

/** An ISO time `minutes` before the capture runs, so the relative times read the same each run. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const FRESH: ExtensionState = {
  approvals: { websites: [], destinations: [] },
  suggestions: [],
  activity: {},
};

const WEBSITE_ONLY: ExtensionState = {
  ...FRESH,
  approvals: { websites: [{ origin: WEBSITE }], destinations: [] },
};

function setUp(): ExtensionState {
  return {
    approvals: { websites: [{ origin: WEBSITE }], destinations: [ACME, GLOBEX] },
    suggestions: [],
    activity: {
      [destinationKey(ACME)]: { at: minutesAgo(4), operation: 'createTimeEntry', outcome: 'ok' },
      [destinationKey(GLOBEX)]: { at: minutesAgo(95), operation: 'fetchTimeLogs', outcome: 'ok' },
    },
  };
}

function withSuggestions(): ExtensionState {
  return {
    ...setUp(),
    suggestions: [
      { ...INITECH_OPENPROJECT, suggestedAt: minutesAgo(2) },
      { ...INITECH_REDMINE, suggestedAt: minutesAgo(1) },
    ],
  };
}

/** Set up, but the browser no longer grants the extension access to Globex Redmine. */
function redmineAccessLost(): ExtensionState {
  const state = setUp();
  return {
    ...state,
    activity: {
      ...state.activity,
      [destinationKey(GLOBEX)]: {
        at: minutesAgo(20),
        operation: 'searchIssues',
        outcome: 'permission',
      },
    },
  };
}

/** Where a screen opens: the toolbar popup, or the setup page in its own tab. */
export type Surface = 'popup' | 'setup';

export type ExtensionScreen = {
  id: string;
  title: string;
  /** One line for the brief: what the screen shows. */
  shows: string;
  surface: Surface;
  /** The storage the extension starts from; built when the screen runs. */
  state: () => ExtensionState;
  /** `partial`: the browser grants access to the website and Acme OpenProject only. */
  access?: 'partial';
  /** Query string of the page, e.g. the setup focus the popup hands over. */
  query?: string;
  /** A website tab that is in front while the page opens, as when the user clicks the toolbar. */
  activeTab?: string;
  /** Runs in the page before its scripts, e.g. to make the extension's storage fail. */
  init?: () => void;
  /** Shown once every one of these selectors is on the page. */
  ready: readonly string[];
  /** Puts the page into the state the screen shows. */
  prepare?: (page: Page) => Promise<void>;
  /** A dialog or toast: captured at viewport height, not grown to the page behind it. */
  overlay?: true;
};

/** The extension API `failStorage` replaces inside the page. */
declare const chrome: { storage: { local: { get: () => Promise<never> } } };

/** Makes the extension's storage unreadable in this page; the worker keeps working. */
function failStorage(): void {
  chrome.storage.local.get = async () => {
    throw new Error('Storage is unavailable.');
  };
}

/** A tracker row showing its last activity: a recorded one carries its outcome icon. */
const POPUP_ACTIVITY = '[data-testid="popup-tracker-activity"]:has(svg)';
const SETUP_ACTIVITY = '[data-testid^="activity-"]:has(svg)';
const SETUP_IDLE = 'main:not([aria-busy="true"])';

const highlighted = destinationKey(INITECH_REDMINE);

export const EXTENSION_SCREENS: ExtensionScreen[] = [
  {
    id: 'e01-popup-fresh',
    title: 'Popup, fresh install',
    shows: 'The toolbar popup right after install: the setup checklist, no website or tracker yet.',
    surface: 'popup',
    state: () => FRESH,
    ready: ['[data-testid="setup-checklist"]'],
  },
  {
    id: 'e02-popup-website-offer',
    title: 'Popup, on the OSI website',
    shows:
      'The popup opened on the OSI Time Tracker website before it is approved: the offer to approve this website above the checklist.',
    surface: 'popup',
    state: () => FRESH,
    activeTab: `${WEBSITE}/`,
    ready: ['[data-testid="current-website-offer"]', '[data-testid="setup-checklist"]'],
  },
  {
    id: 'e03-popup-website-only',
    title: 'Popup, website approved',
    shows:
      'The popup with the website approved and no tracker yet: the checklist on its second step.',
    surface: 'popup',
    state: () => WEBSITE_ONLY,
    ready: ['[data-testid="checklist-tracker"][data-state="current"]'],
  },
  {
    id: 'e04-popup-ready',
    title: 'Popup, set up',
    shows:
      'The popup once set up: the approved website and both trackers, each with its last activity, and the status badge saying all is well.',
    surface: 'popup',
    state: setUp,
    ready: [POPUP_ACTIVITY],
  },
  {
    id: 'e05-popup-suggestions',
    title: 'Popup, suggested trackers',
    shows:
      'The popup with two trackers the website asked to approve, each to dismiss or review on the setup page, above the saved ones.',
    surface: 'popup',
    state: withSuggestions,
    ready: ['[data-testid="suggestions"]', POPUP_ACTIVITY],
  },
  {
    id: 'e06-popup-missing-access',
    title: 'Popup, access lost',
    shows:
      'The popup after the browser took away access to Globex Redmine: the warning, the status badge asking for attention and the tracker marked without access.',
    surface: 'popup',
    state: redmineAccessLost,
    access: 'partial',
    ready: ['[data-testid="popup-missing-access"]', POPUP_ACTIVITY],
  },
  {
    id: 'e07-popup-load-error',
    title: 'Popup, storage error',
    shows: "The popup when the extension's saved settings cannot be read: the error with a retry.",
    surface: 'popup',
    state: () => FRESH,
    init: failStorage,
    ready: ['main [role="alert"]'],
  },
  {
    id: 'e08-setup-fresh',
    title: 'Setup page, fresh install',
    shows:
      'The setup page right after install: language and theme, the checklist, and the empty website and tracker forms.',
    surface: 'setup',
    state: () => FRESH,
    ready: ['[data-testid="setup-checklist"]', SETUP_IDLE],
  },
  {
    id: 'e09-setup-website-handoff',
    title: 'Setup page, website from the popup',
    shows:
      "The setup page as the popup's offer opens it: the website filled in and its approve button focused.",
    surface: 'setup',
    state: () => FRESH,
    query: `?website=${encodeURIComponent(WEBSITE)}`,
    ready: ['[data-testid="add-website"]:focus', SETUP_IDLE],
  },
  {
    id: 'e10-setup-website-only',
    title: 'Setup page, website approved',
    shows:
      'The setup page with the website approved and no tracker yet: the checklist on its second step, the tracker form ready for the website.',
    surface: 'setup',
    state: () => WEBSITE_ONLY,
    ready: ['[data-testid="destination-website-single"]', SETUP_IDLE],
  },
  {
    id: 'e11-setup-ready',
    title: 'Setup page, set up',
    shows:
      'The setup page once set up: the approved website, and both trackers with their website and last activity.',
    surface: 'setup',
    state: setUp,
    ready: [SETUP_ACTIVITY, SETUP_IDLE],
  },
  {
    id: 'e12-setup-suggestions',
    title: 'Setup page, suggested trackers',
    shows:
      "The setup page as the popup's review opens it: two suggested trackers to approve or dismiss, the reviewed one highlighted, the HTTP one with its warning.",
    surface: 'setup',
    state: withSuggestions,
    query: `?suggestion=${encodeURIComponent(highlighted)}`,
    ready: ['[data-testid="suggestions"]', SETUP_ACTIVITY, SETUP_IDLE],
  },
  {
    id: 'e13-setup-missing-access',
    title: 'Setup page, access lost',
    shows:
      'The setup page after the browser took away access to Globex Redmine: the warning naming it, with the restore button.',
    surface: 'setup',
    state: redmineAccessLost,
    access: 'partial',
    ready: ['[data-testid="missing-access"]', '[data-testid="missing-access-restore"]', SETUP_IDLE],
  },
  {
    id: 'e14-setup-form-feedback',
    title: 'Setup page, form feedback',
    shows:
      'The setup forms rejecting a plain-HTTP website address, and warning about a tracker on plain HTTP.',
    surface: 'setup',
    state: setUp,
    ready: [SETUP_ACTIVITY, SETUP_IDLE],
    prepare: async (page) => {
      // Once set up, the add forms sit behind their "Add" buttons.
      await page.getByTestId('new-website').click();
      await page.getByTestId('website-origin').fill('http://time.kowalska.example');
      await page.getByTestId('add-website').click();
      await page.getByTestId('website-origin-error').waitFor();
      await page.getByTestId('new-destination').click();
      await page.getByTestId('destination-url').fill('http://op.initech.example');
      await page.getByTestId('http-warning').waitFor();
    },
  },
  {
    id: 'e15-setup-revoke-website',
    title: 'Setup page, remove website',
    shows: 'The confirmation before removing a website that still has trackers approved for it.',
    surface: 'setup',
    state: setUp,
    ready: [SETUP_ACTIVITY, SETUP_IDLE],
    overlay: true,
    prepare: async (page) => {
      await page.getByTestId(`revoke-website-${WEBSITE}`).click();
      await page.getByTestId('revoke-website-confirm').waitFor();
    },
  },
  {
    id: 'e16-setup-saved-toast',
    title: 'Setup page, change saved',
    shows: 'The notification after a change, here dismissing a suggested tracker.',
    surface: 'setup',
    state: withSuggestions,
    ready: ['[data-testid="suggestions"]', SETUP_ACTIVITY, SETUP_IDLE],
    overlay: true,
    prepare: async (page) => {
      await page.getByTestId(`dismiss-suggestion-${destinationKey(INITECH_OPENPROJECT)}`).click();
      await page.locator('ol[data-slot="viewport"] li').waitFor();
      await page.locator(SETUP_IDLE).waitFor();
    },
  },
  {
    id: 'e17-setup-load-error',
    title: 'Setup page, storage error',
    shows:
      "The setup page when the extension's saved settings cannot be read: the error with a retry instead of the checklist.",
    surface: 'setup',
    state: () => FRESH,
    init: failStorage,
    ready: ['[data-testid="retry-setup"]'],
  },
];
