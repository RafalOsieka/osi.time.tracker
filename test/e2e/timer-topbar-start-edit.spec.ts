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
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

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
      ({ dateValue, timeValue }) => {
        function setInputValue(selector: string, value: string) {
          const input = document.querySelector<HTMLInputElement>(selector);
          if (!input) throw new Error(`input not found: ${selector}`);
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setInputValue('[data-testid="timer-start-editor-date-input"] input', dateValue);
        setInputValue('[data-testid="timer-start-editor-time-input"] input', timeValue);
      },
      { dateValue: `${yyyy}-${mm}-${dd}`, timeValue: '08:00' },
    );

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
