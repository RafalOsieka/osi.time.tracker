// Every screen the capture can take, in two sets: `pages` (each page as it opens, with its main
// state) and `features` (what a page opens or turns into: dialogs, popovers, menus, empty and
// error states). Screens run as one of three users: a signed-out `visitor`, the `busy` user with
// the seeded data (`seed.ts`), or a `new` user with nothing tracked yet.
import type { Page } from 'playwright';
import { TRACKERS, syncDay } from './seed.js';
import { failTrackers } from './trackers.js';

export type ScreenSet = 'pages' | 'features';
export type Persona = 'visitor' | 'busy' | 'new';

export type Screen = {
  id: string;
  title: string;
  /** One line for the brief: what the screen shows. */
  shows: string;
  as: Persona;
  path: string;
  /** Shown once this selector is on the page. */
  ready: string;
  /** Runs before the page loads, e.g. to make a tracker fail. */
  before?: (page: Page) => Promise<void>;
  /** Puts the page into the state the screen shows. */
  prepare?: (page: Page) => Promise<void>;
  /** A dialog, popover or menu: captured at viewport height, not grown to the page behind it. */
  overlay?: true;
};

declare global {
  /** What Nuxt exposes on `window` in the browser, as far as `hydrated` reads it. */
  interface Window {
    useNuxtApp?: () => { isHydrating: boolean };
  }
}

/**
 * Waits until Nuxt has hydrated the page; a click before that is lost. A function, not a string:
 * the app's CSP forbids evaluating strings.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false);
}

/** Expands the first group holding more than one entry, so the shot has open and closed groups. */
async function expandFirstTimerGroup(page: Page): Promise<void> {
  // A group's key is its Task, so the same key repeats on every day; go by the row instead.
  const manyEntries = page.locator('[data-testid^="timer-group-count-"]', {
    hasText: /^\s*([2-9]|\d{2,})\s*$/,
  });
  await page
    .locator('[role="row"]', { has: manyEntries })
    .first()
    .locator('[data-testid^="timer-group-toggle-"]')
    .click();
}

/** Below the desktop breakpoint the sidebar is a drawer behind the top bar's toggle: opens it. */
async function showSidebar(page: Page): Promise<void> {
  if (await page.locator('[data-testid="sidebar-collapse"]').isVisible()) return;
  await page.locator('[data-testid="app-topbar"] [data-slot="toggle"]').click();
  await page.locator('[data-testid="app-user-footer"]:visible').waitFor();
}

/** Picks the first offered activity on the first Remote sync row. */
async function chooseFirstActivity(page: Page): Promise<void> {
  await page.locator('[data-testid^="remote-sync-activity-select-"]').first().click();
  await page.getByRole('option').first().click();
}

const PAGES: Screen[] = [
  {
    id: 'p01-login',
    title: 'Sign in',
    shows: 'The sign-in form a signed-out visitor gets.',
    as: 'visitor',
    path: '/login',
    ready: '[data-testid="login-button"]',
  },
  {
    id: 'p02-timer-view',
    title: 'Timer view',
    shows:
      'The running timer in the top bar and four days of Time entries grouped by Task, one group expanded to its entries, the rest collapsed.',
    as: 'busy',
    path: '/',
    ready: '[data-testid^="timer-group-toggle-"]',
    prepare: expandFirstTimerGroup,
  },
  {
    id: 'p03-projects',
    title: 'Projects',
    shows: 'The Projects list: three bound to a Tracker and one local.',
    as: 'busy',
    path: '/projects',
    ready: '[data-testid="projects-table"]',
  },
  {
    id: 'p04-trackers',
    title: 'Trackers',
    shows: 'The Trackers list: one OpenProject and one Redmine connection.',
    as: 'busy',
    path: '/trackers',
    ready: '[data-testid="trackers-table"]',
  },
  {
    id: 'p05-remote-sync',
    title: 'Remote sync',
    shows:
      "Yesterday's Remote sync: Tasks with their linked issues, activities and time to send, one row expanded to its details, the rest collapsed, and the day's totals including what the trackers already hold.",
    as: 'busy',
    path: `/sync/${syncDay()}`,
    ready: '[data-testid^="remote-sync-expand-"]',
    prepare: async (page) => {
      await page.locator('[data-testid^="remote-sync-expand-"]').first().click();
    },
  },
  {
    id: 'p06-monthly-report',
    title: 'Monthly report',
    shows: "This month's report: hours per day, per Tracker.",
    as: 'busy',
    path: '/reports/monthly',
    ready: '[data-testid="reports-monthly"]',
  },
  {
    id: 'p07-client-report',
    title: 'Client report',
    shows:
      'The client report form for this month, filled in with a client, contractor details and both Trackers selected.',
    as: 'busy',
    path: '/reports/client',
    ready: '[data-testid="client-report-form"]',
    prepare: async (page) => {
      await page.fill('input[data-testid="client-report-client-name"]', 'Acme Corporation');
      await page.fill(
        'textarea[data-testid="client-report-contractor-details"]',
        'Ada Kowalska\nVAT ID: PL1234567890\nul. Długa 1, 00-001 Warszawa',
      );
      for (const { name } of Object.values(TRACKERS)) {
        await page.getByRole('checkbox', { name }).click();
      }
    },
  },
  {
    id: 'p08-profile',
    title: 'Profile',
    shows: 'The Profile page: display name, timezone and preferences.',
    as: 'busy',
    path: '/profile',
    ready: '[data-testid="page-profile"]',
  },
];

const FEATURES: Screen[] = [
  {
    id: 'f01-timer-start-editor',
    title: 'Timer start editor',
    shows: "The popover that moves the running timer's start: date and time.",
    as: 'busy',
    path: '/',
    ready: '[data-testid="timer-elapsed"]',
    overlay: true,
    prepare: async (page) => {
      await page.click('[data-testid="timer-elapsed"]');
      await page.waitForSelector('[data-testid="timer-start-editor-popover"]');
    },
  },
  {
    id: 'f02-add-entry',
    title: 'Add time entry',
    shows: 'The dialog for a manual Time entry, with a new Task typed in as its title.',
    as: 'busy',
    path: '/',
    ready: '[data-testid="timer-view-add-entry"]',
    overlay: true,
    prepare: async (page) => {
      await page.click('[data-testid="timer-view-add-entry"]');
      await page.waitForSelector('[data-testid="add-entry-dialog"]');
      await page
        .locator(
          '[data-testid="add-entry-title-input"] input, input[data-testid="add-entry-title-input"]',
        )
        .first()
        .fill('Sprint planning');
      // Picks the "new task" suggestion, which closes the list over the date field.
      await page.keyboard.press('Enter');
    },
  },
  {
    id: 'f03-issue-picker',
    title: 'Remote issue picker',
    shows: 'Linking a Task to a remote issue from the Timer view: the search and its results.',
    as: 'busy',
    path: '/',
    ready: '[data-testid^="timer-group-remote-issue-unlinked-"]',
    overlay: true,
    prepare: async (page) => {
      await page.locator('[data-testid^="timer-group-remote-issue-unlinked-"]').first().click();
      // The modes are ID, then title, in every language; search by title.
      await page.locator('[data-testid="remote-issue-picker-mode"] [role="radio"]').nth(1).click();
      await page.fill('[data-testid="remote-issue-picker-query"]', 'release');
      await page.click('[data-testid="remote-issue-picker-submit"]');
      await page.waitForSelector('[data-testid="remote-issue-picker-results"]');
    },
  },
  {
    id: 'f04-timer-empty',
    title: 'Timer view, first visit',
    shows: 'The Timer view of a user who has never tracked time.',
    as: 'new',
    path: '/',
    ready: '[data-testid="timer-view-never-tracked"]',
  },
  {
    id: 'f05-project-new',
    title: 'New Project',
    shows: 'The dialog that creates a Project.',
    as: 'busy',
    path: '/projects',
    ready: '[data-testid="new-project-button"]',
    overlay: true,
    prepare: async (page) => {
      await page.click('[data-testid="new-project-button"]');
      await page.waitForSelector('[data-testid="project-dialog"]');
    },
  },
  {
    id: 'f06-project-edit',
    title: 'Edit Project',
    shows: 'The dialog that edits a Project bound to a Tracker.',
    as: 'busy',
    path: '/projects',
    ready: '[data-testid^="edit-project-"]',
    overlay: true,
    prepare: async (page) => {
      await page.locator('[data-testid^="edit-project-"]').first().click();
      await page.waitForSelector('[data-testid="project-dialog"]');
    },
  },
  {
    id: 'f07-project-delete',
    title: 'Delete Project',
    shows: 'The confirmation before a Project with Time entries is deleted.',
    as: 'busy',
    path: '/projects',
    ready: '[data-testid^="delete-project-"]',
    overlay: true,
    prepare: async (page) => {
      await page.locator('[data-testid^="delete-project-"]').first().click();
      await page.waitForSelector('[data-testid="confirm-modal"]');
    },
  },
  {
    id: 'f08-projects-empty',
    title: 'Projects, none yet',
    shows: 'The Projects page before any Project exists.',
    as: 'new',
    path: '/projects',
    ready: '[data-testid="projects-empty-state"]',
  },
  {
    id: 'f09-tracker-new',
    title: 'New Tracker',
    shows: 'The dialog that connects a Tracker: type, base URL, API secret, rounding.',
    as: 'busy',
    path: '/trackers',
    ready: '[data-testid="new-tracker-button"]',
    overlay: true,
    prepare: async (page) => {
      await page.click('[data-testid="new-tracker-button"]');
      await page.waitForSelector('[data-testid="tracker-dialog"]');
    },
  },
  {
    id: 'f10-tracker-import',
    title: 'Import from a Tracker',
    shows: "The import dialog's first step: the date range and the remote projects to scan.",
    as: 'busy',
    path: '/trackers',
    ready: '[data-testid^="import-tracker-"]',
    overlay: true,
    prepare: async (page) => {
      await page.locator('[data-testid^="import-tracker-"]').first().click();
      await page.waitForSelector('[data-testid="tracker-import-dialog"]');
    },
  },
  {
    id: 'f11-trackers-empty',
    title: 'Trackers, none yet',
    shows: 'The Trackers page before any Tracker is connected.',
    as: 'new',
    path: '/trackers',
    ready: '[data-testid="trackers-empty-state"]',
  },
  {
    id: 'f12-sync-activity-picker',
    title: 'Remote sync, activity picker',
    shows: "A Remote sync row's activity list open, with the tracker's activities.",
    as: 'busy',
    path: `/sync/${syncDay()}`,
    ready: '[data-testid^="remote-sync-activity-select-"]',
    overlay: true,
    prepare: async (page) => {
      await page.locator('[data-testid^="remote-sync-activity-select-"]').first().click();
      await page.getByRole('option').first().waitFor();
    },
  },
  {
    id: 'f13-sync-export-review',
    title: 'Remote sync, export review',
    shows: 'The review before sending time to the trackers: what will be sent, per Task.',
    as: 'busy',
    path: `/sync/${syncDay()}`,
    ready: '[data-testid^="remote-sync-activity-select-"]',
    overlay: true,
    prepare: async (page) => {
      await chooseFirstActivity(page);
      await page.click('[data-testid="remote-sync-export-button"]');
      await page.waitForSelector('[data-testid="remote-sync-export-dialog-body"]');
    },
  },
  {
    id: 'f14-sync-tracker-down',
    title: 'Remote sync, tracker unreachable',
    shows:
      'Remote sync while both trackers fail: activities and the logs already in the tracker cannot load.',
    as: 'busy',
    path: `/sync/${syncDay()}`,
    ready: '[data-testid="remote-sync-page"]',
    before: failTrackers,
  },
  {
    id: 'f15-navigation',
    title: 'Navigation',
    shows:
      'The navigation in its other form: the collapsed rail on desktop, the open drawer on narrower screens.',
    as: 'busy',
    path: '/',
    ready: '[data-testid="app-topbar"]',
    prepare: async (page) => {
      const collapse = page.locator('[data-testid="sidebar-collapse"]');
      if (await collapse.isVisible()) await collapse.click();
      else await showSidebar(page);
    },
  },
  {
    id: 'f16-user-menu',
    title: 'User menu',
    shows: "The user menu open from the sidebar's footer.",
    as: 'busy',
    path: '/',
    ready: '[data-testid="app-topbar"]',
    overlay: true,
    prepare: async (page) => {
      await showSidebar(page);
      await page.locator('[data-testid="app-user-footer-trigger"]:visible').first().click();
      await page.getByRole('menu').waitFor();
    },
  },
  {
    id: 'f17-extension-status',
    title: 'Extension status',
    shows: "The browser extension's status details, open from the sidebar's footer.",
    as: 'busy',
    path: '/',
    ready: '[data-testid="app-topbar"]',
    overlay: true,
    prepare: async (page) => {
      await showSidebar(page);
      // `force`: in the phone drawer the trigger never settles for Playwright's stability check.
      await page
        .locator('[data-testid="extension-status-trigger"]:visible')
        .first()
        .click({ force: true });
      await page.waitForSelector('[data-testid="extension-status-popover"]');
    },
  },
];

export const SCREENS = { pages: PAGES, features: FEATURES } satisfies Record<ScreenSet, Screen[]>;
