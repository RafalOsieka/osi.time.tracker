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

  it('adds a manual entry from a day section and sees it grouped correctly', async () => {
    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    const addButtonSelector = '[data-testid^="timer-day-add-entry-"]';
    await page.waitForSelector(addButtonSelector);
    await page.click(addButtonSelector);
    await page.waitForSelector('[data-testid="add-entry-dialog"]');

    await page.fill('[data-testid="add-entry-title-input"] input', 'Manual Add Entry Task');
    await page.fill('[data-testid="add-entry-start-input"]', '08:00');
    await page.fill('[data-testid="add-entry-end-input"]', '09:00');
    await page.click('[data-testid="add-entry-dialog"] [data-testid="save-button"]');
    await page.waitForSelector('[data-testid="add-entry-dialog"]', { state: 'hidden' });

    await page.waitForFunction(() => document.body.textContent?.includes('Manual Add Entry Task'));

    await page.close();
  });

  it('blocks adding a manual entry with an inverted time range', async () => {
    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    const addButtonSelector = '[data-testid^="timer-day-add-entry-"]';
    await page.waitForSelector(addButtonSelector);
    await page.click(addButtonSelector);
    await page.waitForSelector('[data-testid="add-entry-dialog"]');

    await page.fill('[data-testid="add-entry-title-input"] input', 'Inverted Range Task');
    await page.fill('[data-testid="add-entry-start-input"]', '10:00');
    await page.fill('[data-testid="add-entry-end-input"]', '09:00');
    await page.click('[data-testid="add-entry-dialog"] [data-testid="save-button"]');

    await page.waitForSelector('[data-testid="add-entry-range-error"]');
    // Dialog should stay open (no request was sent) and the entry should not appear.
    expect(await page.isVisible('[data-testid="add-entry-dialog"]')).toBe(true);

    await page.click('[data-testid="add-entry-dialog"] [data-testid="cancel-button"]');
    await page.close();
  });

  it('edits an entry inline, retitles it to split into another group, and deletes it', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const seeded = await startEntry(jar, token, { title: 'Inline Edit Source Task' });
    await stopEntry(jar, token, seeded.id);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Inline Edit Source Task'),
    );

    const sourceGroup = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'Inline Edit Source Task',
      })
      .first();
    await sourceGroup.locator('[data-testid^="timer-group-toggle-"]').click();

    const entrySelector = `[data-testid="timer-entry-${seeded.id}"]`;
    await page.waitForSelector(entrySelector);

    // --- Inline start-time edit ---
    await page.click(`[data-testid="timer-entry-start-${seeded.id}"]`);
    await page.fill(`[data-testid="timer-entry-start-input-${seeded.id}"]`, '07:30');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      (id) =>
        document
          .querySelector(`[data-testid="timer-entry-start-${id}"]`)
          ?.textContent?.includes('07:30'),
      seeded.id,
    );

    // --- Retitle causing a group split ---
    await page.click(`[data-testid="timer-entry-title-${seeded.id}"]`);
    await page.fill(`[data-testid="timer-entry-title-input-${seeded.id}"]`, 'Inline Edit New Task');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.textContent?.includes('Inline Edit New Task'));

    const newGroup = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'Inline Edit New Task',
      })
      .first();
    await newGroup.locator('[data-testid^="timer-group-toggle-"]').click();
    await page.waitForSelector(entrySelector);

    // --- Delete with confirmation ---
    await page.click(`[data-testid="timer-entry-delete-${seeded.id}"]`);
    await page.click('.p-confirmdialog-accept-button');
    await page.waitForSelector(entrySelector, { state: 'detached' });

    await page.close();
  });
});
