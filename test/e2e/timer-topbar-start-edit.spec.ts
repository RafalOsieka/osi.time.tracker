import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';

const describeTopbarStartEdit = requireBrowser();

describeTopbarStartEdit('5.5 topbar running-entry start edit', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'topbarstartedit@example.com', displayName: 'Topbar' }]);
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

  async function startEntry(jar: CookieJar, token: string, body: Record<string, unknown> = {}) {
    const res = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify(body),
    });
    return res.json();
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

  it('commits a compact typed time in the popover and rebases the elapsed ticker', async () => {
    const { jar, token } = await apiLogin('topbarstartedit@example.com');
    const running = await startEntry(jar, token, { title: 'Compact Time Edit' });

    const page = await loginAs('topbarstartedit@example.com');
    await page.waitForSelector('[data-testid="timer-elapsed"][aria-label="Edit start time"]');

    await page.click('[data-testid="timer-elapsed"]');
    await page.waitForSelector('[data-testid="timer-start-editor-popover"]');

    // Move the date to yesterday so any time of day is in the past.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    await page.evaluate(
      ({ dateValue }) => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="timer-start-editor-date-input"]',
        );
        if (!input) throw new Error('date input not found');
        input.value = dateValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { dateValue: `${yyyy}-${mm}-${dd}` },
    );

    // Type a compact value: `830` must normalize to `08:30` on Enter.
    const timeInput = page.locator('[data-testid="timer-start-editor-time-input"]');
    await timeInput.fill('830');
    await timeInput.press('Enter');
    await expect.poll(() => timeInput.inputValue()).toBe('08:30');

    await page.click('[data-testid="timer-start-editor-save-button"]');
    const errorLocator = page.locator('[data-testid="timer-start-editor-error"]');
    if (await errorLocator.count()) {
      throw new Error(`start editor error: ${await errorLocator.textContent()}`);
    }
    await page.waitForSelector('[data-testid="timer-start-editor-popover"]', { state: 'hidden' });

    // The elapsed ticker rebases to > 24h (yesterday 08:30) while staying running.
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="timer-elapsed"]');
      if (!el?.textContent) return false;
      const hours = Number(el.textContent.split(':')[0]);
      return Number.isFinite(hours) && hours >= 24;
    });

    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const updated = await runningRes.json();
    expect(updated.id).toBe(running.id);
    expect(updated.stoppedAt).toBeNull();
    expect(new Date(updated.startedAt).getTime()).toBeLessThan(
      new Date(running.startedAt).getTime(),
    );

    // Cleanup: stop the entry so it doesn't leak into other test files.
    await fetch(url(`/api/time-entries/${updated.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });

    await page.close();
  });

  it('edits the running entry start (including a previous date) and rebases elapsed while staying running', async () => {
    const { jar, token } = await apiLogin('topbarstartedit@example.com');
    const running = await startEntry(jar, token, { title: 'Topbar Start Edit' });

    const page = await loginAs('topbarstartedit@example.com');
    await page.waitForSelector('[data-testid="timer-elapsed"][aria-label="Edit start time"]');

    await page.click('[data-testid="timer-elapsed"]');
    await page.waitForSelector('[data-testid="timer-start-editor-popover"]');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');

    await page.evaluate(
      ({ dateValue }) => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="timer-start-editor-date-input"]',
        );
        if (!input) throw new Error('date input not found');
        input.value = dateValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { dateValue: `${yyyy}-${mm}-${dd}` },
    );

    // The shared TimeInput commits on blur/Enter, so type and press Enter.
    const timeInput = page.locator('[data-testid="timer-start-editor-time-input"]');
    await timeInput.fill('08:00');
    await timeInput.press('Enter');

    await page.click('[data-testid="timer-start-editor-save-button"]');
    const errorLocator = page.locator('[data-testid="timer-start-editor-error"]');
    if (await errorLocator.count()) {
      throw new Error(`start editor error: ${await errorLocator.textContent()}`);
    }
    await page.waitForSelector('[data-testid="timer-start-editor-popover"]', { state: 'hidden' });

    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="timer-elapsed"]');
      return el?.textContent && !el.textContent.includes('00:00:0');
    });

    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const updated = await runningRes.json();
    expect(updated.id).toBe(running.id);
    expect(updated.stoppedAt).toBeNull();
    expect(new Date(updated.startedAt).getTime()).toBeLessThan(
      new Date(running.startedAt).getTime(),
    );

    // Cleanup: stop the entry so it doesn't leak into other test files.
    await fetch(url(`/api/time-entries/${updated.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });

    await page.close();
  });
});
