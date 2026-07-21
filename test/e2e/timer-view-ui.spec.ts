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
    await page.locator('[data-testid="email"] input, [data-testid="email"]').first().fill(email);
    await page
      .locator('[data-testid="password"] input, [data-testid="password"]')
      .first()
      .fill('secret');
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
    await page
      .locator(
        '[data-testid="bulk-assign-name-input"] input, [data-testid="bulk-assign-name-input"]',
      )
      .first()
      .fill('Bulk Assigned Task');
    await page.click('[data-testid="bulk-assign-dialog"] [data-testid="save-button"]');
    await page.waitForSelector('[data-testid="bulk-assign-dialog"]', { state: 'hidden' });
    await page.waitForFunction(() => document.body.textContent?.includes('Bulk Assigned Task'));

    // --- Inline rename merge ---
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
    await duplicateGroup
      .locator('[data-testid^="timer-group-title-"]:not([data-testid*="title-input"])')
      .click();
    // After the click the group's visible text changes (button → input), so the
    // hasText-filtered group locator no longer matches; find the single active
    // title input globally instead.
    const renameInput = page.locator('[data-testid^="timer-group-title-input-"]');
    await renameInput.fill('UI Timer Task');
    await renameInput.press('Enter');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('UI Timer Task Duplicate'),
    );

    await page.close();
  });

  it('load more extends the visible window to include older entries', async () => {
    // Ensure the default window is non-empty (so the footer load-more control renders)
    // and insert an entry older than that window via the DB.
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const recent = await startEntry(jar, token, { title: 'Load More Anchor' });
    await stopEntry(jar, token, recent.id);

    const { db, sql } = createDatabaseClient(dbUrl, { max: 3 });
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'timerviewui@example.com'));
      if (!user) throw new Error('seeded user not found');

      // Far enough back that week-aligned 7- and 14-day windows may still exclude it
      // depending on the weekday the suite runs; the loop below loads until it appears.
      const oldStart = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
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
    await page.waitForFunction(() => document.body.textContent?.includes('Load More Anchor'));

    // Not visible within the default week-aligned window.
    const beforeCount = await page.locator('[data-testid^="timer-day-"]').count();

    // Week-aligned windows expand by full weeks; one click is not always enough.
    const loadMore = page.locator(
      '[data-testid="timer-view-load-more"], [data-testid="empty-state-cta"]',
    );
    for (let i = 0; i < 4; i++) {
      const count = await page.locator('[data-testid^="timer-day-"]').count();
      if (count > beforeCount) break;
      await loadMore.first().click();
      await page.waitForTimeout(500);
    }
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

    await page
      .locator('[data-testid="add-entry-title-input"] input, [data-testid="add-entry-title-input"]')
      .first()
      .fill('Manual Add Entry Task');
    await page
      .locator('[data-testid="add-entry-start-input"] input, [data-testid="add-entry-start-input"]')
      .first()
      .fill('08:00');
    await page
      .locator('[data-testid="add-entry-end-input"] input, [data-testid="add-entry-end-input"]')
      .first()
      .fill('09:00');
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

    await page
      .locator('[data-testid="add-entry-title-input"] input, [data-testid="add-entry-title-input"]')
      .first()
      .fill('Inverted Range Task');
    await page
      .locator('[data-testid="add-entry-start-input"] input, [data-testid="add-entry-start-input"]')
      .first()
      .fill('10:00');
    await page
      .locator('[data-testid="add-entry-end-input"] input, [data-testid="add-entry-end-input"]')
      .first()
      .fill('09:00');
    await page.click('[data-testid="add-entry-dialog"] [data-testid="save-button"]');

    await page.waitForSelector('[data-testid="add-entry-range-error"]');
    // Dialog should stay open (no request was sent) and the entry should not appear.
    expect(await page.isVisible('[data-testid="add-entry-dialog"]')).toBe(true);

    await page.click('[data-testid="add-entry-dialog"] [data-testid="cancel-button"]');
    await page.close();
  });

  it('assigns a project inline via the "(no project)" placeholder', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');

    const clientRes = await fetch(url('/api/clients'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Inline Assign Client ' + Date.now() }),
    });
    const client = await clientRes.json();
    const projectRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Inline Assign Project', clientId: client.id }),
    });
    const project = await projectRes.json();
    expect(project.id).toBeDefined();

    const seeded = await startEntry(jar, token, { title: 'Inline Project Assign Task' });
    await stopEntry(jar, token, seeded.id);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Inline Project Assign Task'),
    );

    const group = page
      .locator('[data-testid^="timer-group-"]:not([data-testid="timer-group-untitled"])', {
        hasText: 'Inline Project Assign Task',
      })
      .first();

    // The "(no project)" placeholder is an activatable button; click it, then open the select.
    await group
      .locator('[data-testid^="timer-group-project-"]:not([data-testid*="project-select"])')
      .click();
    await group.locator('[data-testid^="timer-group-project-select-"]').click();
    await page.getByRole('option', { name: 'Inline Assign Project' }).click();

    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid^="timer-group-project-"]')
        ?.closest('body')
        ?.textContent?.includes('Inline Assign Project'),
    );
    const groupText = await group.textContent();
    expect(groupText).toContain('Inline Assign Project');

    await page.close();
  });

  it('shows a stopped entry in the timer view after stopping from the top-bar widget', async () => {
    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    // Start a timer from the top-bar widget.
    await page
      .locator('[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]')
      .first()
      .fill('Topbar Stop Task');
    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );

    // Stop it from the top-bar widget; the timer view must refresh itself
    // (no manual reload) and show the finished entry in its day/task group.
    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Start',
    );
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="timer-view-page"]')
        ?.textContent?.includes('Topbar Stop Task'),
    );

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
    await page.click('[data-testid="confirm-accept"]');
    await page.waitForSelector(entrySelector, { state: 'detached' });

    await page.close();
  });
});
