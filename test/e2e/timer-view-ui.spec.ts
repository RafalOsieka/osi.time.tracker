import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { eq } from 'drizzle-orm';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';
import { createDatabaseClient } from '../../server/db/client';
import { users } from '../../server/db/schema/users';
import { timeEntries } from '../../server/db/schema/time-entries';

const describeTimerViewUI = requireBrowser();

describeTimerViewUI('timer view UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [{ email: 'timerviewui@example.com', displayName: 'timerviewuiuser' }]);
  await setupServer({ databaseUrl: dbUrl, browser: true });

  async function loginAs(email: string) {
    const page = await createPage('/');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.fill('[data-testid="email"]', email);
    await page.fill('[data-testid="password"] input', 'secret');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-topbar"]');
    return page;
  }

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

  async function stopEntry(jar: CookieJar, token: string, id: string) {
    await fetch(url(`/api/time-entries/${id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });
  }

  it('lists seeded entries grouped by day and task, and supports continue/bulk-assign/merge/load-more', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');

    // Seed a titled entry (today) and an untitled entry (today).
    const titled = await startEntry(jar, token, { title: 'UI Timer Task' });
    await stopEntry(jar, token, titled.id);
    const untitled = await startEntry(jar, token, {});
    await stopEntry(jar, token, untitled.id);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    await page.waitForFunction(() => document.body.textContent?.includes('UI Timer Task'));
    expect(await page.textContent('[data-testid="timer-view-page"]')).toContain('UI Timer Task');

    const untitledGroupSelector = '[data-testid="timer-group-untitled"]';
    await page.waitForSelector(untitledGroupSelector);

    // --- Continue action ---
    const continueSelector = '[data-testid^="timer-group-continue-"]';
    await page.click(continueSelector);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );
    // Stop it via API to avoid leaking a running entry into other assertions.
    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const running = await runningRes.json();
    if (running) await stopEntry(jar, token, running.id);

    // --- Bulk-assign action ---
    await page.click(`${untitledGroupSelector} [data-testid^="timer-group-bulk-assign-"]`);
    await page.waitForSelector('[data-testid="bulk-assign-dialog"]');
    await page.fill('[data-testid="bulk-assign-name-input"] input', 'Bulk Assigned Task');
    await page.click('[data-testid="bulk-assign-dialog"] [data-testid="save-button"]');
    await page.waitForSelector('[data-testid="bulk-assign-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('Bulk Assigned Task'));

    // --- Mini-editor rename merge ---
    // Create a second entry under a task with the same target name to force a merge on rename.
    const other = await startEntry(jar, token, { title: 'UI Timer Task Duplicate' });
    await stopEntry(jar, token, other.id);
    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('UI Timer Task Duplicate'),
    );

    const duplicateGroup = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'UI Timer Task Duplicate',
      })
      .first();
    await duplicateGroup.locator('[data-testid^="timer-group-edit-"]').click();
    await page.waitForSelector('[data-testid="timer-task-editor-dialog"]');
    await page.fill('[data-testid="timer-task-editor-name-input"]', 'UI Timer Task');
    await page.click('[data-testid="timer-task-editor-dialog"] [data-testid="save-button"]');
    await page.waitForSelector('[data-testid="timer-task-editor-dialog"]', { state: 'hidden' });
    await page.waitForFunction(
      () => !document.body.textContent?.includes('UI Timer Task Duplicate'),
    );

    await page.close();
  });

  it('load more extends the visible window to include older entries', async () => {
    // Insert an entry older than the default 7-day window directly via the DB.
    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'timerviewui@example.com'));
      if (!user) throw new Error('seeded user not found');

      const oldStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const oldStop = new Date(oldStart.getTime() + 30 * 60 * 1000);
      await db.insert(timeEntries).values({
        userId: user.id,
        taskId: null,
        startedAt: oldStart,
        stoppedAt: oldStop,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    // Not visible within the default 7-day window.
    const beforeCount = await page.locator('[data-testid^="timer-day-"]').count();

    await page.click('[data-testid="timer-view-load-more"]');
    await page.waitForFunction(
      (prev) => document.querySelectorAll('[data-testid^="timer-day-"]').length > prev,
      beforeCount,
    );

    await page.close();
  });
});
