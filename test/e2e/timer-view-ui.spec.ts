import { expect, it } from 'vitest';
import { createPage, url } from '@nuxt/test-utils/e2e';
import { eq } from 'drizzle-orm';
import { requireBrowser } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';
import { CookieJar, primeCsrf } from './support/auth';
import {
  groupKeyForTitleScript,
  pageExcludesTextScript,
  pageIncludesTextScript,
} from './support/dom';
import { createDatabaseClient } from '../../server/db/client';
import { users } from '../../server/db/schema/users';
import { timeEntries } from '../../server/db/schema/time-entries';

const describeTimerViewUI = requireBrowser();
const pageIncludesText = pageIncludesTextScript();
const pageExcludesText = pageExcludesTextScript();
const groupKeyForTitle = groupKeyForTitleScript();

describeTimerViewUI('timer view UI flow', async () => {
  const dbUrl = await provisionDatabase();
  await seedUsers(dbUrl, [
    { email: 'timerviewui@example.com', displayName: 'timerviewuiuser' },
    { email: 'timerviewfresh@example.com', displayName: 'timerviewfreshuser' },
  ]);
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

    await page.waitForFunction(pageIncludesText, 'UI Timer Task');
    expect(
      await page.evaluate(
        (t) =>
          [...document.querySelectorAll('input')].some((el) =>
            (el as HTMLInputElement).value.includes(t),
          ),
        'UI Timer Task',
      ),
    ).toBe(true);

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
    await page.waitForFunction(pageIncludesText, 'Bulk Assigned Task');

    // --- Inline rename merge ---
    // Create a second entry under a task with the same target name to force a merge on rename.
    const other = await startEntry(jar, token, { title: 'UI Timer Task Duplicate' });
    await stopEntry(jar, token, other.id);
    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'UI Timer Task Duplicate');

    expect(other.taskId).toBeTruthy();
    const duplicateTitle = page.locator(`[data-testid="timer-group-title-${other.taskId}"]`);
    await duplicateTitle.locator('input').or(duplicateTitle).first().click();
    const renameInput = page.locator(`[data-testid="timer-group-title-input-${other.taskId}"]`);
    await renameInput.locator('input').or(renameInput).first().fill('UI Timer Task');
    await renameInput.locator('input').or(renameInput).first().press('Enter');
    await page.waitForFunction(pageExcludesText, 'UI Timer Task Duplicate');

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
    await page.waitForFunction(pageIncludesText, 'Load More Anchor');

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
    // Use a range that is always in the past on the current local day, including
    // when the suite runs shortly after midnight (08:00–09:00 would be "future").
    await page
      .locator('[data-testid="add-entry-start-input"] input, [data-testid="add-entry-start-input"]')
      .first()
      .fill('00:00');
    await page
      .locator('[data-testid="add-entry-end-input"] input, [data-testid="add-entry-end-input"]')
      .first()
      .fill('00:01');
    await page.click('[data-testid="add-entry-dialog"] [data-testid="save-button"]');
    await page.waitForSelector('[data-testid="add-entry-dialog"]', { state: 'hidden' });

    await page.waitForFunction(pageIncludesText, 'Manual Add Entry Task');

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

    const clientRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Inline Assign Client ' + Date.now() }),
    });
    const tracker = await clientRes.json();
    const projectRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Inline Assign Project', trackerId: tracker.id }),
    });
    const project = await projectRes.json();
    expect(project.id).toBeDefined();

    const seeded = await startEntry(jar, token, { title: 'Inline Project Assign Task' });
    await stopEntry(jar, token, seeded.id);
    expect(seeded.taskId).toBeTruthy();

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Inline Project Assign Task');

    // Click the project placeholder for this task group (testid is on UInput root).
    const projectDisplay = page.locator(`[data-testid="timer-group-project-${seeded.taskId}"]`);
    await projectDisplay.locator('input').or(projectDisplay).first().click();
    const projectSelect = page.locator(
      `[data-testid="timer-group-project-select-${seeded.taskId}"]`,
    );
    await projectSelect.waitFor();
    await projectSelect.click();
    await page.getByRole('option', { name: 'Inline Assign Project' }).click();

    await page.waitForFunction(pageIncludesText, 'Inline Assign Project');
    expect(
      await page.evaluate(
        (t) =>
          [...document.querySelectorAll('input')].some((el) =>
            (el as HTMLInputElement).value.includes(t),
          ),
        'Inline Assign Project',
      ),
    ).toBe(true);

    await page.close();
  });

  it('shows a stopped entry in the timer view after stopping from the top-bar widget', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    // Ensure no leftover running timer from earlier tests confuses the Start/Stop toggle.
    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const running = await runningRes.json();
    if (running?.id) {
      await stopEntry(jar, token, running.id);
    }

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Start',
    );

    // Start a timer from the top-bar widget.
    const titleInput = page
      .locator('[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]')
      .first();
    await titleInput.click();
    await titleInput.fill('Topbar Stop Task');
    // Close the suggestion overlay so the Start click is unambiguous.
    await titleInput.press('Escape');
    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );

    // Dismiss any open autocomplete overlay that could intercept the Stop click.
    await page.keyboard.press('Escape');
    const stopResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/time-entries/') &&
        response.ok(),
    );
    // DOM click avoids intermittent actionability flakes on the loading button.
    await page.locator('[data-testid="timer-toggle-button"]').evaluate((el: HTMLElement) => {
      el.click();
    });
    await stopResponse;
    await page.waitForFunction(
      () =>
        (
          document.querySelector('[data-testid="timer-toggle-button"]')?.textContent ?? ''
        ).trim() === 'Start',
    );
    // After stop, the list refresh may still be on an older anchored week — reset if needed.
    const reset = page.locator('[data-testid="timer-view-reset-to-current-week"]');
    if ((await reset.count()) > 0) {
      await reset.click();
    }
    await page.waitForFunction(pageIncludesText, 'Topbar Stop Task');

    await page.close();
  });

  it('starting from a suggestion binds the picked task project and survives reload', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const clientRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Suggestion Client ' + Date.now() }),
    });
    const tracker = await clientRes.json();
    const projectRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Suggestion Project', trackerId: tracker.id }),
    });
    const project = await projectRes.json();
    const seedTitle = 'Suggestion Source Task ' + Date.now();
    const seeded = await startEntry(jar, token, { title: seedTitle, projectId: project.id });
    await stopEntry(jar, token, seeded.id);

    // Start bound to the seeded task id (what the top-bar sends after a
    // suggestion pick), then verify the timer page reflects project context
    // and survives reload.
    const startRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ taskId: seeded.taskId }),
    });
    expect(startRes.status).toBe(200);
    const started = await startRes.json();
    expect(started.taskId).toBe(seeded.taskId);
    expect(started.projectId).toBe(project.id);
    expect(started.taskName).toBe(seedTitle);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );
    await page.waitForFunction(pageIncludesText, seedTitle);
    await page.waitForFunction(pageIncludesText, 'Suggestion Project');

    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );
    await page.waitForFunction(pageIncludesText, seedTitle);
    await page.waitForFunction(pageIncludesText, 'Suggestion Project');

    await stopEntry(jar, token, started.id);
    await page.close();
  });

  it('renaming a multi-day task group moves only that day entries', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const title = 'Multi Day Rename Source ' + Date.now();
    const olderStart = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const olderStop = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const older = await startEntry(jar, token, {
      title,
      startedAt: olderStart,
      stoppedAt: olderStop,
    });
    const newer = await startEntry(jar, token, { title });
    await stopEntry(jar, token, newer.id);
    expect(older.taskId).toBe(newer.taskId);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, title);

    const todayTitle = page.locator(`[data-testid="timer-group-title-${newer.taskId}"]`);
    await todayTitle.locator('input').or(todayTitle).first().click();
    const renameInput = page.locator(`[data-testid="timer-group-title-input-${newer.taskId}"]`);
    const renamed = 'Multi Day Rename Target ' + Date.now();
    await renameInput.locator('input').or(renameInput).first().fill(renamed);
    await renameInput.locator('input').or(renameInput).first().press('Enter');
    await page.waitForFunction(pageIncludesText, renamed);

    const from = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const rows = await (
      await fetch(
        url(`/api/time-entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        { headers: { cookie: jar.header() } },
      )
    ).json();
    const olderRow = rows.find((r: { id: string }) => r.id === older.id);
    const newerRow = rows.find((r: { id: string }) => r.id === newer.id);
    expect(olderRow.taskName).toBe(title);
    expect(newerRow.taskName).toBe(renamed);
    expect(newerRow.taskId).not.toBe(olderRow.taskId);

    await page.close();
  });

  it('edits an entry inline, retitles it to split into another group, and deletes it', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const seeded = await startEntry(jar, token, { title: 'Inline Edit Source Task' });
    await stopEntry(jar, token, seeded.id);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, 'Inline Edit Source Task');

    // Expand the matching group so the entry row is visible.
    expect(seeded.taskId).toBeTruthy();
    const toggle = page.locator(`[data-testid="timer-group-toggle-${seeded.taskId}"]`);
    await toggle.locator('button').or(toggle).first().click();
    await page.waitForSelector(`[data-testid="timer-entry-${seeded.id}"]`, { timeout: 10000 });

    // Retitle the entry (splits it into a new group on commit).
    const entryTitle = page.locator(`[data-testid="timer-entry-title-${seeded.id}"]`);
    await entryTitle.locator('input').or(entryTitle).first().click();
    const titleInput = page.locator(`[data-testid="timer-entry-title-input-${seeded.id}"]`);
    await titleInput.locator('input').or(titleInput).first().fill('Inline Edit Target Task');
    await titleInput.locator('input').or(titleInput).first().press('Enter');
    await page.waitForFunction(pageIncludesText, 'Inline Edit Target Task');

    // After the split, expand the new group so the entry row is interactive again.
    const targetGroupKey = await page.evaluate(groupKeyForTitle, 'Inline Edit Target Task');
    if (!targetGroupKey) throw new Error('target group not found');
    const targetToggle = page.locator(`[data-testid="timer-group-toggle-${targetGroupKey}"]`);
    await targetToggle.locator('button').or(targetToggle).first().click();
    await page.waitForSelector(`[data-testid="timer-entry-${seeded.id}"]`);

    // Delete the entry.
    const deleteBtn = page.locator(`[data-testid="timer-entry-delete-${seeded.id}"]`);
    await deleteBtn.locator('button').or(deleteBtn).first().click();
    await page.locator('[data-testid="confirm-accept"]').click();
    await page.waitForFunction(pageExcludesText, 'Inline Edit Target Task');

    await page.close();
  });

  it('opens on an earlier tracked week with a signpost and can reset to the current week', async () => {
    const email = 'timerviewanchor@example.com';
    await seedUsers(dbUrl, [{ email, displayName: 'timerviewanchoruser' }]);
    const { jar, token } = await apiLogin(email);

    const oldStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const oldStop = new Date(oldStart.getTime() + 30 * 60 * 1000);
    const pastTitle = 'Anchored Week Task ' + Date.now();
    await startEntry(jar, token, {
      title: pastTitle,
      startedAt: oldStart.toISOString(),
      stoppedAt: oldStop.toISOString(),
    });

    const page = await loginAs(email);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, pastTitle);
    await page.waitForSelector('[data-testid="timer-view-anchored-week-banner"]');
    await page.waitForSelector('[data-testid="timer-view-reset-to-current-week"]');

    await page.click('[data-testid="timer-view-reset-to-current-week"]');
    await page.waitForSelector('[data-testid="timer-view-anchored-week-banner"]', {
      state: 'hidden',
    });
    await page.waitForFunction(pageExcludesText, pastTitle);
    // Current week is empty for this user — empty-window state (not never-tracked).
    await page.waitForSelector('[data-testid="timer-view-empty-state"]');

    await page.close();
  });

  it('shows the never-tracked empty state for a user with no entries', async () => {
    const page = await loginAs('timerviewfresh@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForSelector('[data-testid="timer-view-never-tracked"]');
    expect(await page.locator('[data-testid="timer-view-load-more"]').count()).toBe(0);
    expect(await page.locator('[data-testid="timer-view-empty-state"]').count()).toBe(0);
    await page.close();
  });

  it('create-new-task option starts a project-less entry even when a project-bound task matches', async () => {
    const { jar, token } = await apiLogin('timerviewui@example.com');
    const clientRes = await fetch(url('/api/trackers'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Create Option Client ' + Date.now() }),
    });
    const tracker = await clientRes.json();
    const projectRes = await fetch(url('/api/projects'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ name: 'Create Option Project', trackerId: tracker.id }),
    });
    const project = await projectRes.json();
    const sharedTitle = 'Create Option Shared Title ' + Date.now();
    const seeded = await startEntry(jar, token, { title: sharedTitle, projectId: project.id });
    await stopEntry(jar, token, seeded.id);
    expect(seeded.projectId).toBe(project.id);

    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    const titleInput = page
      .locator('[data-testid="timer-title-input"] input, [data-testid="timer-title-input"]')
      .first();
    await titleInput.click();
    await titleInput.fill(sharedTitle);

    // Wait for the matching suggestion and the synthetic create-new-task option.
    await page.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 10000 });
    const createOption = page
      .locator('[role="option"]')
      .filter({ hasText: /new task/i })
      .first();
    await createOption.waitFor({ state: 'visible', timeout: 10000 });
    // Combobox options can re-render mid-click; use a DOM click for stability.
    await createOption.evaluate((el: HTMLElement) => el.click());

    await page.click('[data-testid="timer-toggle-button"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="timer-toggle-button"]')?.textContent === 'Stop',
    );

    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const running = await runningRes.json();
    expect(running.taskName).toBe(sharedTitle);
    expect(running.projectId).toBeNull();
    expect(running.taskId).not.toBe(seeded.taskId);

    await stopEntry(jar, token, running.id);
    await page.close();
  });
});
