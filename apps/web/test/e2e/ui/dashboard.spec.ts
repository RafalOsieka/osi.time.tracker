import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { apiLogin, patchTimezone } from '../helpers/auth';
import { createProject, startEntry } from '../helpers/http';
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
    const share = page.locator('[data-testid="dashboard-groups-table"] td').last();
    const shareBox = await share.boundingBox();
    expect((shareBox?.x ?? Infinity) + (shareBox?.width ?? Infinity)).toBeLessThanOrEqual(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    await page.close();
  });
});
