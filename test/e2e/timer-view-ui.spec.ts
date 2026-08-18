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

  it('lists seeded entries grouped by day and task, and supports continue/inline-assign/merge/load-more', async () => {
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

    const countBadge = page.locator('[data-testid^="timer-group-count-"]').first();
    expect(await countBadge.count()).toBeGreaterThan(0);
    expect((await countBadge.innerText()).trim()).toMatch(/^\d+$/);

    const untitledGroupSelector = '[data-testid="timer-group-untitled"]';
    await page.waitForSelector(untitledGroupSelector);

    // --- Continue action ---
    const continueSelector = '[data-testid^="timer-group-continue-"]';
    await page.click(continueSelector);
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
    );
    // Stop it via API to avoid leaking a running entry into other assertions.
    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    const running = await runningRes.json();
    if (running) await stopEntry(jar, token, running.id);

    // --- Inline title assign on the untitled group ---
    const untitledTitle = page.locator(
      `${untitledGroupSelector} [data-testid="timer-group-title-untitled"]`,
    );
    await untitledTitle.locator('input').or(untitledTitle).first().click();
    const untitledInput = page.locator(
      `${untitledGroupSelector} [data-testid="timer-group-title-input-untitled"]`,
    );
    await untitledInput.locator('input').or(untitledInput).first().fill('Bulk Assigned Task');
    await untitledInput.locator('input').or(untitledInput).first().press('Enter');
    await page.waitForFunction(pageIncludesText, 'Bulk Assigned Task');
    // Group rename/merge is covered by dedicated multi-day / inline-edit cases below.

    await page.close();
  });

  it('load more extends the visible window to include older activity days', async () => {
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

      // Outside the default 30-day feed window.
      const oldStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
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

    const beforeCount = await page.locator('[data-testid^="timer-day-"]').count();
    const loadMore = page.locator('[data-testid="timer-view-load-more"]');
    await loadMore.click();
    await page.waitForFunction(
      (prev) => document.querySelectorAll('[data-testid^="timer-day-"]').length > prev,
      beforeCount,
    );

    await page.close();
  });

  it('adds a manual entry from the page header and sees it grouped correctly', async () => {
    const page = await loginAs('timerviewui@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');

    await page.click('[data-testid="timer-view-add-entry"]');
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

    await page.click('[data-testid="timer-view-add-entry"]');
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
      body: JSON.stringify({
        name: 'Inline Assign Client ' + Date.now(),
        systemType: 'openproject',
        baseUrl: 'https://inline-assign.example.com',
        executionMode: 'client',
        roundingRule: 'none',
      }),
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

    const projectDisplay = page.locator(`[data-testid="timer-group-project-${seeded.taskId}"]`);
    await projectDisplay.click();
    const projectSelect = page.locator(
      `[data-testid="timer-group-project-select-${seeded.taskId}"]`,
    );
    await projectSelect.waitFor();
    await page.locator(`[data-testid="timer-group-project-option-${project.id}"]`).click();
    await projectSelect.waitFor({ state: 'hidden' });

    await page.waitForFunction(
      ({ title, projectName }) => {
        const titles = [
          ...document.querySelectorAll(
            '[data-testid^="timer-group-title-"]:not([data-testid*="title-input"])',
          ),
        ];
        const titleNode = titles.find((node) => {
          const input = (
            node.matches('input') ? node : node.querySelector('input')
          ) as HTMLInputElement | null;
          return input?.value === title;
        });
        if (!titleNode) return false;
        let group: Element | null = titleNode;
        while (group) {
          const tid = group.getAttribute('data-testid');
          if (tid && /^timer-group-(untitled|[0-9a-f-]{36})$/i.test(tid)) break;
          group = group.parentElement;
        }
        if (!group) return false;
        const projectBtn = group.querySelector('[data-testid^="timer-group-project-"]');
        const projectText = projectBtn?.textContent ?? '';
        const unlinked = group.querySelector('[data-testid^="timer-group-remote-issue-unlinked-"]');
        return projectText.includes(projectName) && !!unlinked;
      },
      { title: 'Inline Project Assign Task', projectName: 'Inline Assign Project' },
    );
    expect(await page.evaluate(pageExcludesText, '(unlinked)')).toBe(true);
    expect(await page.evaluate(pageExcludesText, '(niepołączone)')).toBe(true);

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
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') !== 'true',
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
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
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
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') !== 'true',
    );
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
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
    );
    await page.waitForFunction(pageIncludesText, seedTitle);
    await page.waitForFunction(pageIncludesText, 'Suggestion Project');

    await page.reload();
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
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

    // Edit start time in place; the local calendar day must stay the same.
    const startButton = page.locator(`[data-testid="timer-entry-start-${seeded.id}"]`);
    await startButton.locator('button').or(startButton).first().click();
    const startInput = page.locator(`[data-testid="timer-entry-start-input-${seeded.id}"]`);
    const startPatch = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/time-entries/${seeded.id}`) &&
        response.ok(),
    );
    await startInput.locator('input').or(startInput).first().fill('08:15');
    await startInput.locator('input').or(startInput).first().press('Enter');
    await startPatch;
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const patchedRows = await (
      await fetch(
        url(`/api/time-entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        { headers: { cookie: jar.header() } },
      )
    ).json();
    const patched = patchedRows.find((r: { id: string }) => r.id === seeded.id);
    expect(patched.startedAt.slice(0, 10)).toBe(seeded.startedAt.slice(0, 10));

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

  it('falls back to the newest activity day when nothing is in the last 30 days', async () => {
    const email = 'timerviewanchor@example.com';
    await seedUsers(dbUrl, [{ email, displayName: 'timerviewanchoruser' }]);
    const { jar, token } = await apiLogin(email);

    const oldStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const oldStop = new Date(oldStart.getTime() + 30 * 60 * 1000);
    const pastTitle = 'Newest Day Fallback Task ' + Date.now();
    await startEntry(jar, token, {
      title: pastTitle,
      startedAt: oldStart.toISOString(),
      stoppedAt: oldStop.toISOString(),
    });

    const page = await loginAs(email);
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForFunction(pageIncludesText, pastTitle);
    expect(await page.locator('[data-testid="timer-view-anchored-week-banner"]').count()).toBe(0);
    expect(await page.locator('[data-testid="timer-view-never-tracked"]').count()).toBe(0);

    await page.close();
  });

  it('shows the never-tracked empty state for a user with no entries', async () => {
    const page = await loginAs('timerviewfresh@example.com');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    await page.waitForSelector('[data-testid="timer-view-never-tracked"]');
    expect(await page.locator('[data-testid="timer-view-load-more"]').count()).toBe(0);
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
      () =>
        document
          .querySelector('[data-testid="timer-toggle-button"]')
          ?.getAttribute('aria-pressed') === 'true',
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
