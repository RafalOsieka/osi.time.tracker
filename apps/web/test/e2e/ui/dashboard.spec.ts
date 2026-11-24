import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { apiLogin, patchTimezone } from '../helpers/auth';
import { zoneAwayFromMidnight } from '../helpers/fixtures';
import { createProject, createTracker, startEntry } from '../helpers/http';
import { seedUser } from '../helpers/seed';
import { loginAs, reloadHydrated } from '../helpers/ui';
import { url } from '../helpers/url';

const describeDashboardUi = requireBrowser();

async function waitForLabel(page: Page, label: string): Promise<void> {
  await page
    .locator('[data-testid="dashboard-period-label"]', {
      hasText: new RegExp(`^\\s*${label}\\s*$`),
    })
    .waitFor();
  await page.waitForSelector('[data-testid="dashboard-summary"]');
}

function total(page: Page): Promise<string | null> {
  return page.textContent('[data-testid="dashboard-total"]');
}

function groupRows(page: Page): Promise<string[][]> {
  return page
    .locator('[data-testid="dashboard-groups-table"] tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll<HTMLElement>('th, td')].map((cell) => cell.innerText.trim()),
      ),
    );
}

/** Whether today's day and the weekday labels of the 12-month heatmap are inside its box. */
async function pastYearInView(page: Page): Promise<{ today: boolean; weekdays: boolean }> {
  const heatmap = page.locator('[data-testid="dashboard-past-year-scroll"]');
  const [box, today, weekday] = await Promise.all([
    heatmap.boundingBox(),
    // The tab stop starts on today.
    heatmap.locator('[data-testid="dashboard-past-year-cell"][tabindex="0"]').boundingBox(),
    heatmap.locator('[data-testid="dashboard-past-year-row"]').first().boundingBox(),
  ]);
  if (!box || !today || !weekday) throw new Error('The 12-month heatmap is drawn');
  const inside = (part: { x: number; width: number }) =>
    part.x >= box.x - 1 && part.x + part.width <= box.x + box.width + 1;
  return { today: inside(today), weekdays: inside(weekday) };
}

describeDashboardUi('Dashboard journey', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('goes from login through periods to the Timer view', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    await patchTimezone(jar, token, 'UTC');
    const project = await createProject(jar, token, 'Books');
    for (const entry of [
      {
        startedAt: '2026-03-31T10:00:00.000Z',
        stoppedAt: '2026-03-31T12:00:00.000Z',
        projectId: null,
      },
      {
        startedAt: '2026-04-01T10:00:00.000Z',
        stoppedAt: '2026-04-01T13:30:00.000Z',
        projectId: project.id,
      },
    ]) {
      const created = await startEntry(jar, token, { title: 'Work', ...entry });
      expect(created.status).toBe(200);
    }

    const page = await createPage('/login');
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="dashboard-page"]');
    expect(new URL(page.url()).pathname).toBe('/');
    await page.waitForSelector('[data-testid="dashboard-summary"]');
    expect(await page.isDisabled('[data-testid="dashboard-next"]')).toBe(true);

    await page.goto(url('/?period=month&date=2026-04-15'), { waitUntil: 'hydration' });
    await waitForLabel(page, 'April 2026');
    expect(await total(page)).toBe('3:30');
    expect(await groupRows(page)).toEqual([['Books', '3:30', '100%']]);

    await page.focus('[data-testid="dashboard-grouping-project"]');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="dashboard-grouping-tracker"][aria-pressed="true"]');
    expect(await groupRows(page)).toEqual([['Local', '3:30', '100%']]);
    expect(new URL(page.url()).search).toBe('?period=month&date=2026-04-15');

    await page.click('[data-testid="dashboard-prev"]');
    await waitForLabel(page, 'March 2026');
    expect(new URL(page.url()).search).toBe('?period=month&date=2026-03-31');
    expect(await total(page)).toBe('2:00');

    await page.click('[data-testid="dashboard-kind-week"]');
    await page.waitForURL('**/?period=week&date=2026-03-31');
    await page.locator('[data-testid="dashboard-total"]', { hasText: '5:30' }).waitFor();
    expect(await page.textContent('[data-testid="dashboard-days"]')).toBe('2');
    expect(await page.textContent('[data-testid="dashboard-average"]')).toBe('2:45');
    expect(await groupRows(page)).toEqual([
      ['Local', '3:30', '64%'],
      ['No project', '2:00', '36%'],
    ]);

    await reloadHydrated(page);
    expect(await total(page)).toBe('5:30');
    expect(await page.getAttribute('[data-testid="dashboard-kind-week"]', 'aria-pressed')).toBe(
      'true',
    );

    await page.goBack();
    await waitForLabel(page, 'March 2026');
    expect(new URL(page.url()).search).toBe('?period=month&date=2026-03-31');

    // Choosing the same kind again retries a failed load.
    await page.route('**/api/dashboard**', (route) => route.fulfill({ status: 500 }));
    await page.click('[data-testid="dashboard-prev"]');
    await page.waitForSelector('[data-testid="dashboard-error"]');
    await page.unroute('**/api/dashboard**');
    await page.click('[data-testid="dashboard-kind-month"]');
    await waitForLabel(page, 'February 2026');

    await page.click('[data-testid="app-sidebar"] a[href="/timer"]');
    await page.waitForSelector('[data-testid="timer-view-page"]');
    expect(new URL(page.url()).pathname).toBe('/timer');

    await page.click('[data-testid="app-sidebar"] a[href="/"]');
    await page.waitForSelector('[data-testid="dashboard-page"]');
    expect(new URL(page.url()).search).toBe('');
    await page.close();
  });

  it('draws the chart on the server and reads it by keyboard and pointer', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    await patchTimezone(jar, token, 'UTC');
    const books = await createProject(jar, token, 'Books');
    for (const [startedAt, stoppedAt, projectId] of [
      ['2026-04-01T08:00:00.000Z', '2026-04-01T10:00:00.000Z', books.id],
      ['2026-04-01T10:00:00.000Z', '2026-04-01T11:00:00.000Z', null],
      ['2026-04-02T08:00:00.000Z', '2026-04-02T09:30:00.000Z', books.id],
    ] as const) {
      const created = await startEntry(jar, token, {
        title: 'Work',
        startedAt,
        stoppedAt,
        projectId,
      });
      expect(created.status).toBe(200);
    }

    const page = await createPage('/login');
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (/hydration/i.test(message.text())) warnings.push(message.text());
    });
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="dashboard-page"]');
    const response = await page.goto(url('/?period=month&date=2026-04-15'), {
      waitUntil: 'hydration',
    });
    const html = (await response?.text()) ?? '';
    expect(html.match(/data-testid="dashboard-chart-column"/g)).toHaveLength(30);
    expect(html.match(/data-testid="dashboard-chart-segment"/g)).toHaveLength(3);

    const layoutShifts = await page.evaluate(
      () =>
        new Promise<unknown[]>((resolve) => {
          const shifts: unknown[] = [];
          new PerformanceObserver((list) => {
            shifts.push(...list.getEntries().map((entry) => entry.toJSON()));
          }).observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => resolve(shifts), 500);
        }),
    );
    expect(z.array(z.object({ value: z.number() })).parse(layoutShifts)).toEqual([]);
    expect(warnings).toEqual([]);

    const cell = (day: number) =>
      page.locator('[data-testid="dashboard-chart-column"]').nth(day - 1);
    const tooltip = page.locator('[data-testid="dashboard-chart-tooltip"]');
    await page.focus('[data-testid="dashboard-grouping-tracker"]');
    await page.keyboard.press('Tab');
    expect(await cell(1).evaluate((element) => element === document.activeElement)).toBe(true);
    expect(await cell(1).getAttribute('aria-label')).toBe(
      'Wed, Apr 1: 3:00, of which Books 2:00, No project 1:00',
    );
    await tooltip.waitFor();
    await page.keyboard.press('ArrowRight');
    expect(await cell(2).evaluate((element) => element === document.activeElement)).toBe(true);
    await tooltip.filter({ hasText: 'Thu, Apr 2' }).waitFor();
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'detached' });

    // Leaving the chart and coming back lands on the column left last.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await cell(2).evaluate((element) => element === document.activeElement)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await tooltip.waitFor({ state: 'detached' });

    await cell(1).hover();
    await tooltip.filter({ hasText: 'Wed, Apr 1' }).waitFor();
    // Up the column onto the tooltip, which stays to be read.
    const box = await cell(1).boundingBox();
    const above = await tooltip.boundingBox();
    if (!box || !above) throw new Error('The column and its tooltip are visible');
    await page.mouse.move(box.x + box.width / 2, box.y + 2);
    await page.mouse.move(box.x + box.width / 2, above.y + above.height / 2, { steps: 5 });
    await tooltip.filter({ hasText: 'Wed, Apr 1' }).waitFor();
    await page.keyboard.press('Escape');
    await tooltip.waitFor({ state: 'detached' });
    await cell(1).hover();
    await tooltip.waitFor();
    await page.mouse.move(0, 0);
    await tooltip.waitFor({ state: 'detached' });
    await page.close();
  });

  it('opens the week of a day picked in the 12-month heatmap, from the top', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    const { timezone, offset, today } = zoneAwayFromMidnight();
    await patchTimezone(jar, token, timezone);
    const day = Temporal.PlainDate.from(today).subtract({ days: 10 }).toString();
    const created = await startEntry(jar, token, {
      title: 'Work',
      startedAt: `${day}T01:00:00${offset}`,
      stoppedAt: `${day}T03:30:00${offset}`,
    });
    expect(created.status).toBe(200);

    const page = await createPage('/login');
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="dashboard-summary"]');
    const response = await page.goto(url('/'), { waitUntil: 'hydration' });
    const firstDay = Temporal.PlainDate.from(today).subtract({ years: 1 }).add({ days: 1 });
    expect(
      ((await response?.text()) ?? '').match(/data-testid="dashboard-past-year-cell"/g),
    ).toHaveLength(firstDay.until(today).days + 1);

    const dayName = new Intl.DateTimeFormat('en', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    // From today a week back and three days up.
    await page.focus('[data-testid="dashboard-past-year-cell"][tabindex="0"]');
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp'])
      await page.keyboard.press(key);
    expect(await focused()).toBe(`${dayName}: 2:30`);
    await page
      .locator('[data-testid="dashboard-past-year-tooltip"]', { hasText: dayName })
      .waitFor();
    const scrolled = () =>
      page.locator('[data-testid="dashboard-page"]').evaluate((page) => {
        let top = 0;
        for (let element: Element | null = page; element; element = element.parentElement) {
          top = Math.max(top, element.scrollTop);
        }
        return top;
      });
    expect(await scrolled()).toBeGreaterThan(0);

    await page.keyboard.press('Enter');
    await page.waitForURL(`**/?period=week&date=${day}`);
    await page.waitForSelector('[data-testid="dashboard-kind-week"][aria-pressed="true"]');
    await page.locator('[data-testid="dashboard-total"]', { hasText: '2:30' }).waitFor();
    expect(await scrolled()).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe(
      'dashboard-kind-week',
    );
    await page.close();
  });

  it('shows when the user works by weekday and hour, from the server', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    const { timezone, offset, today } = zoneAwayFromMidnight();
    await patchTimezone(jar, token, timezone);
    const yesterday = Temporal.PlainDate.from(today).subtract({ days: 1 }).toString();
    const created = await startEntry(jar, token, {
      title: 'Work',
      startedAt: `${yesterday}T01:00:00${offset}`,
      stoppedAt: `${yesterday}T03:30:00${offset}`,
    });
    expect(created.status).toBe(200);

    const page = await createPage('/login');
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="dashboard-summary"]');
    const response = await page.goto(url('/'), { waitUntil: 'hydration' });
    expect(
      ((await response?.text()) ?? '').match(/data-testid="dashboard-weekday-hours-cell"/g),
    ).toHaveLength(7 * 24);

    const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${yesterday}T00:00:00Z`),
    );
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    // A twelfth of each hour: 60, 60 and 30 minutes.
    await page.focus(
      `[data-testid="dashboard-weekday-hours-cell"][aria-label="${weekday}, 1:00 AM–2:00 AM: 0:05"]`,
    );
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe(`${weekday}, 2:00 AM–3:00 AM: 0:05`);
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe(`${weekday}, 3:00 AM–4:00 AM: 0:02`);
    await page
      .locator('[data-testid="dashboard-weekday-hours-tooltip"]', {
        hasText: `${weekday}, 3:00 AM–4:00 AM`,
      })
      .waitFor();
    await page.close();
  });

  it('leads from a day in the Export backlog to its Remote Sync page', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    const { timezone, offset, today } = zoneAwayFromMidnight();
    await patchTimezone(jar, token, timezone);
    const tracker = await createTracker(jar, token, 'Redmine');
    const project = await createProject(jar, token, 'Site', tracker.id);
    const yesterday = Temporal.PlainDate.from(today).subtract({ days: 1 }).toString();
    const created = await startEntry(jar, token, {
      title: 'Work',
      projectId: project.id,
      startedAt: `${yesterday}T01:00:00${offset}`,
      stoppedAt: `${yesterday}T02:00:00${offset}`,
    });
    expect(created.status).toBe(200);

    const page = await createPage('/login');
    await loginAs(page, user.email, user.password);
    await page.waitForSelector('[data-testid="dashboard-summary"]');
    const response = await page.goto(url('/'), { waitUntil: 'hydration' });
    expect((await response?.text()) ?? '').toContain('data-testid="dashboard-export-backlog"');
    await page.click(`[data-testid="dashboard-export-backlog"] a[href="/sync/${yesterday}"]`);
    await page.waitForSelector('[data-testid="remote-sync-page"]');
    expect(new URL(page.url()).pathname).toBe(`/sync/${yesterday}`);
    await page.close();
  });

  it('fits a phone without scrolling the page sideways', async () => {
    const user = await seedUser(dbUrl);
    const page = await createPage('/login');
    await loginAs(page, user.email, user.password, { width: 360, height: 800 });
    // A week across two years has the longest label.
    await page.goto(url('/?period=week&date=2026-12-30'), { waitUntil: 'hydration' });
    await page.waitForSelector('[data-testid="dashboard-empty-account"]');
    for (const id of ['dashboard-kind-year', 'dashboard-next', 'empty-state-cta']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect((box?.x ?? Infinity) + (box?.width ?? Infinity)).toBeLessThanOrEqual(360);
    }

    const { jar, token } = await apiLogin(user.email, user.password);
    expect((await startEntry(jar, token, { title: 'Work' })).status).toBe(200);
    await reloadHydrated(page);
    await page.waitForSelector('[data-testid="dashboard-summary"]');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );

    const project = await createProject(jar, token, 'Long'.repeat(20));
    const created = await startEntry(jar, token, {
      title: 'Work',
      projectId: project.id,
      startedAt: '2026-04-01T10:00:00.000Z',
      stoppedAt: '2026-04-01T13:30:00.000Z',
    });
    expect(created.status).toBe(200);
    await page.goto(url('/?period=month&date=2026-04-15'), { waitUntil: 'hydration' });
    expect(await groupRows(page)).toEqual([[project.name, '3:30', '100%']]);
    const scroll = page.locator('[data-testid="dashboard-chart-scroll"]');
    expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    for (const id of ['dashboard-past-year-scroll', 'dashboard-weekday-hours-scroll']) {
      const heatmap = page.locator(`[data-testid="${id}"]`);
      expect(await heatmap.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
        true,
      );
    }
    // The 12-month heatmap shows its latest weeks already in the server's HTML, so nothing jumps
    // when scripts run.
    const serverOnly = await createPage('/?period=month&date=2026-04-15', {
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
      storageState: await page.context().storageState(),
    });
    for (const shown of [serverOnly, page]) {
      expect(await pastYearInView(shown)).toEqual({ today: true, weekdays: true });
    }
    await serverOnly.close();
    const share = page.locator('[data-testid="dashboard-groups-table"] td').last();
    const shareBox = await share.boundingBox();
    expect((shareBox?.x ?? Infinity) + (shareBox?.width ?? Infinity)).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await page.close();
  });
});
