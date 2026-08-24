import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs as fillLogin } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { pageIncludesTextScript } from '../helpers/dom';

const describeSettingsUI = requireBrowser();
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
  return ({ dayKey, title }) => {
    const day = document.querySelector(`[data-testid="timer-day-${dayKey}"]`);
    if (!day) return false;
    if (day.textContent?.includes(title)) return true;
    for (const el of day.querySelectorAll('input, textarea')) {
      if ((el as HTMLInputElement).value?.includes(title)) return true;
    }
    return false;
  };
}

const dayIncludesTitle = dayIncludesTitleScript();

describeSettingsUI('user settings UI flow', async () => {
  const dbUrl = await provisionDatabase();
  const user = await seedUser(dbUrl, { displayName: 'settingsuiuser' });
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function openAuthed() {
    const page = await createPage('/');
    await fillLogin(page, user.email, user.password, { height: 900 });
    return page;
  }

  it('changes timezone on /settings, persists across reload, and regroups the timer view', async () => {
    const { jar, token } = await apiLogin(user.email, user.password);

    // Deterministic baseline so the "before" grouping doesn't depend on the
    // browser's detected timezone.
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: BASELINE_TIME_ZONE }),
    });

    // A recent (safely-in-the-past) instant: its calendar day under the
    // baseline zone and under the shifted zone is guaranteed to differ.
    const startedAt = new Date(Date.now() - 2 * 60 * 1000);
    const stoppedAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    const baselineDayKey = dayKeyIn(startedAt, BASELINE_TIME_ZONE);

    const createRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        title: 'Settings UI Task',
        startedAt: startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
      }),
    });
    expect(createRes.status).toBe(200);

    const page = await openAuthed();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Settings UI Task');
    await page.waitForSelector(`[data-testid="timer-day-${baselineDayKey}"]`);
    expect(
      await page.evaluate(dayIncludesTitle, {
        dayKey: baselineDayKey,
        title: 'Settings UI Task',
      }),
    ).toBe(true);

    // --- Navigate to the settings page and change timezone ---
    // Preferences auto-apply on change (no Save button).
    await page.click('a[href="/settings"]');
    await page.waitForSelector('[data-testid="page-settings"]');
    // Controls mount only after client preference sources settle (no default flash).
    await page.waitForSelector('[data-testid="settings-preferences"]');
    expect(await page.locator('button:has-text("Save settings")').count()).toBe(0);
    expect(await page.locator('[data-testid="settings-saved-message"]').count()).toBe(0);
    expect(await page.locator('[data-testid="settings-week-start"]').count()).toBe(0);

    // Language and theme controls live on Settings (not the utility menu).
    expect(await page.locator('[data-testid="settings-language"]').count()).toBe(1);
    expect(await page.locator('[data-testid="settings-theme"]').count()).toBe(1);

    await page.click('#settings-timezone');
    await page.getByRole('option', { name: SHIFTED_TIME_ZONE }).click();

    // Wait for auto-persist: controls should keep the selected values after network settles.
    await expect
      .poll(() => page.locator('#settings-timezone').textContent())
      .toContain(SHIFTED_TIME_ZONE);

    // --- Persistence across reload ---
    await page.reload();
    await page.waitForSelector('[data-testid="page-settings"]');
    await expect
      .poll(() => page.locator('#settings-timezone').textContent())
      .toContain(SHIFTED_TIME_ZONE);

    // --- The timer view regroups the same data under the new timezone ---
    await page.goto(url('/'));
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Settings UI Task');

    // The entry has moved out of its previous day bucket...
    const stillInBaselineDay = await page
      .locator(`[data-testid="timer-day-${baselineDayKey}"]`)
      .count();
    if (stillInBaselineDay > 0) {
      expect(
        await page.evaluate(dayIncludesTitle, {
          dayKey: baselineDayKey,
          title: 'Settings UI Task',
        }),
      ).toBe(false);
    }

    // ...and re-appears grouped under the day computed for the new timezone.
    const shiftedDayKey = dayKeyIn(startedAt, SHIFTED_TIME_ZONE);
    if ((await page.locator(`[data-testid="timer-day-${shiftedDayKey}"]`).count()) === 0) {
      const loadMore = page.locator('[data-testid="timer-view-load-more"]');
      if ((await loadMore.count()) > 0) {
        await loadMore.click();
      }
    }
    await page.waitForSelector(`[data-testid="timer-day-${shiftedDayKey}"]`);
    expect(
      await page.evaluate(dayIncludesTitle, {
        dayKey: shiftedDayKey,
        title: 'Settings UI Task',
      }),
    ).toBe(true);

    await page.close();
  });
});
