import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeSettingsUI = requireBrowser();

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

describeSettingsUI('user settings UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'settingsui@example.com', displayName: 'settingsuiuser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function apiLogin(email: string) {
    const jar = new CookieJar();
    const token = await primeCsrf(jar);
    const res = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ email, password: 'secret' }),
    });
    jar.capture(res);
    return { jar, token };
  }

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

  it('changes timezone and week start on /settings, persists across reload, and regroups the timer view', async () => {
    const { jar, token } = await apiLogin('settingsui@example.com');

    // Deterministic baseline so the "before" grouping doesn't depend on the
    // browser's detected timezone.
    await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ timezone: BASELINE_TIME_ZONE, weekStart: 'monday' }),
    });

    // A recent (safely-in-the-past) instant: its calendar day under the
    // baseline zone and under the shifted zone is guaranteed to differ.
    const startedAt = new Date(Date.now() - 2 * 60 * 1000);
    const stoppedAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    const baselineDayKey = dayKeyIn(startedAt, BASELINE_TIME_ZONE);

    await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({
        title: 'Settings UI Task',
        startedAt: startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
      }),
    });

    const page = await loginAs('settingsui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() => document.body.textContent?.includes('Settings UI Task'));
    await page.waitForSelector(`[data-testid="timer-day-${baselineDayKey}"]`);
    expect(await page.textContent(`[data-testid="timer-day-${baselineDayKey}"]`)).toContain(
      'Settings UI Task',
    );

    // --- Navigate to the settings page and change timezone + week start ---
    await page.click('a[href="/settings"]');
    await page.waitForSelector('[data-testid="page-settings"]');

    await page.click('#settings-timezone');
    await page.getByRole('option', { name: SHIFTED_TIME_ZONE }).click();

    const weekStartGroup = page.locator('#settings-week-start');
    await weekStartGroup.getByText('Sunday').click();

    await page.click('button:has-text("Save settings")');
    await page.waitForSelector('[data-testid="settings-saved-message"]');

    // --- Persistence across reload ---
    await page.reload();
    await page.waitForSelector('[data-testid="page-settings"]');
    await expect
      .poll(() => page.locator('#settings-timezone').textContent())
      .toContain(SHIFTED_TIME_ZONE);
    expect(
      await page
        .locator('#settings-week-start')
        .getByRole('radio', { name: /sunday/i })
        .getAttribute('aria-checked'),
    ).toBe('true');

    // --- The timer view regroups the same data under the new timezone,
    // purely client-side (no data refetch) ---
    await page.goto(url('/'));
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() => document.body.textContent?.includes('Settings UI Task'));

    // The entry has moved out of its previous day bucket...
    const stillInBaselineDay = await page
      .locator(`[data-testid="timer-day-${baselineDayKey}"]`)
      .count();
    if (stillInBaselineDay > 0) {
      expect(await page.textContent(`[data-testid="timer-day-${baselineDayKey}"]`)).not.toContain(
        'Settings UI Task',
      );
    }

    // ...and re-appears grouped under the day computed for the new timezone
    // (falling back to "load more" if that day sits outside the default
    // window relative to the current week).
    const shiftedDayKey = dayKeyIn(startedAt, SHIFTED_TIME_ZONE);
    if ((await page.locator(`[data-testid="timer-day-${shiftedDayKey}"]`).count()) === 0) {
      await page.click('[data-testid="timer-view-load-more"]');
    }
    await page.waitForSelector(`[data-testid="timer-day-${shiftedDayKey}"]`);
    expect(await page.textContent(`[data-testid="timer-day-${shiftedDayKey}"]`)).toContain(
      'Settings UI Task',
    );

    await page.close();
  });
});
