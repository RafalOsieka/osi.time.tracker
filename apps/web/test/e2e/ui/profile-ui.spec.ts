import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin, reloadHydrated } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { pageIncludesTextScript } from '../helpers/dom';

const describeProfileUI = requireBrowser();
const pageIncludesText = pageIncludesTextScript();

// `Pacific/Pago_Pago` (UTC-11) and `Pacific/Kiritimati` (UTC+14) are both
// supported IANA zones with a combined offset spread of 25 hours, so any
// single instant is guaranteed to fall on a different calendar day in one
// zone versus the other, regardless of the time of day the suite runs at.
const BASELINE_TIME_ZONE = 'Pacific/Pago_Pago';
const SHIFTED_TIME_ZONE = 'Pacific/Kiritimati';

function dayKeyIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dayIncludesTitleScript(): (args: { dayKey: string; title: string }) => boolean {
  // The day heading row and its group rows are siblings in one list, so scan the rows after
  // the heading up to the next day's heading.
  return ({ dayKey, title }) => {
    const day = document.querySelector(`[data-testid="timer-day-${dayKey}"]`);
    if (!day) return false;
    for (
      let row = day.nextElementSibling;
      row && !row.matches('[data-testid^="timer-day-"][role="row"]');
      row = row.nextElementSibling
    ) {
      if (row.textContent?.includes(title)) return true;
      for (const el of row.querySelectorAll('input, textarea')) {
        if (
          (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
          el.value.includes(title)
        ) {
          return true;
        }
      }
    }
    return false;
  };
}

const dayIncludesTitle = dayIncludesTitleScript();

describeProfileUI('profile UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openAuthed(user: { email: string; password: string }) {
    const page = await createPage('/');
    await fillLogin(page, user.email, user.password, { height: 900 });
    return page;
  }

  /** Opens /profile through the sidebar account menu (REQ-405). */
  async function openProfileFromMenu(page: Awaited<ReturnType<typeof openAuthed>>) {
    await page.click('[data-testid="app-user-footer-trigger"]');
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await page.waitForSelector('[data-testid="page-profile"]');
    // The menu returns focus to its trigger as it closes; let that finish before the
    // test opens another popover, or the timezone list closes under the click.
    await page.getByRole('menu').waitFor({ state: 'detached' });
  }

  it('edits the display name on blur and updates the footer without a reload', async () => {
    const user = await seedUser(dbUrl, { displayName: 'Profile Before' });
    const page = await openAuthed(user);
    await openProfileFromMenu(page);
    expect(await page.title()).toBe('Profile | OSI Time Tracker');
    expect(await page.locator('[data-testid="profile-email"]').inputValue()).toBe(user.email);

    const name = page.locator('[data-testid="profile-display-name"]');
    expect(await name.inputValue()).toBe('Profile Before');
    await name.fill('  Profile After  ');
    await name.blur();

    await expect
      .poll(() => page.locator('[data-testid="app-user-footer-primary"]').textContent())
      .toBe('Profile After');
    expect(await name.inputValue()).toBe('Profile After');

    await reloadHydrated(page);
    await page.waitForSelector('[data-testid="page-profile"]');
    expect(await page.locator('[data-testid="profile-display-name"]').inputValue()).toBe(
      'Profile After',
    );
    expect(await page.locator('[data-testid="app-user-footer-primary"]').textContent()).toBe(
      'Profile After',
    );
    await page.close();
  });

  it('switches the language from the profile page', async () => {
    const user = await seedUser(dbUrl);
    const page = await openAuthed(user);
    await openProfileFromMenu(page);

    await page.click('#profile-language');
    await page.getByRole('option', { name: 'Polish' }).click();
    await page.waitForFunction(pageIncludesText, 'Nazwa wyświetlana');
    expect(await page.locator('html').getAttribute('lang')).toMatch(/^pl/);
    await page.close();
  });

  it('changes timezone on /profile, persists across reload, and regroups the timer view', async () => {
    const user = await seedUser(dbUrl, { timezone: BASELINE_TIME_ZONE });
    const { jar, token } = await apiLogin(user.email, user.password);

    // A recent (safely-in-the-past) instant: its calendar day under the
    // baseline zone and under the shifted zone is guaranteed to differ.
    const startedAt = new Date(Date.now() - 2 * 60 * 1000);
    const stoppedAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    const baselineDayKey = dayKeyIn(startedAt, BASELINE_TIME_ZONE);

    const createRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        title: 'Profile UI Task',
        startedAt: startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
      }),
    });
    expect(createRes.status).toBe(200);

    const page = await openAuthed(user);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Profile UI Task');
    await page.waitForSelector(`[data-testid="timer-day-${baselineDayKey}"]`);
    expect(
      await page.evaluate(dayIncludesTitle, {
        dayKey: baselineDayKey,
        title: 'Profile UI Task',
      }),
    ).toBe(true);

    // --- Open the profile page and change timezone (auto-applies, no Save button) ---
    await openProfileFromMenu(page);
    expect(await page.locator('button:has-text("Save")').count()).toBe(0);
    expect(await page.locator('[data-testid="profile-language"]').count()).toBe(1);

    await page.click('#profile-timezone');
    await page.getByRole('option', { name: SHIFTED_TIME_ZONE }).click();

    await expect
      .poll(() => page.locator('#profile-timezone').textContent())
      .toContain(SHIFTED_TIME_ZONE);

    // --- Persistence across reload ---
    await reloadHydrated(page);
    await page.waitForSelector('[data-testid="page-profile"]');
    await expect
      .poll(() => page.locator('#profile-timezone').textContent())
      .toContain(SHIFTED_TIME_ZONE);

    // --- The timer view regroups the same data under the new timezone ---
    await page.goto(url('/'), { waitUntil: 'hydration' });
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Profile UI Task');

    // The entry has moved out of its previous day bucket...
    const stillInBaselineDay = await page
      .locator(`[data-testid="timer-day-${baselineDayKey}"]`)
      .count();
    if (stillInBaselineDay > 0) {
      expect(
        await page.evaluate(dayIncludesTitle, {
          dayKey: baselineDayKey,
          title: 'Profile UI Task',
        }),
      ).toBe(false);
    }

    // ...and re-appears grouped under the day computed for the new timezone
    // (older days load automatically while the list end is in view).
    const shiftedDayKey = dayKeyIn(startedAt, SHIFTED_TIME_ZONE);
    await page.waitForSelector(`[data-testid="timer-day-${shiftedDayKey}"]`);
    expect(
      await page.evaluate(dayIncludesTitle, {
        dayKey: shiftedDayKey,
        title: 'Profile UI Task',
      }),
    ).toBe(true);

    await page.close();
  });
});
