import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createPage } from '@nuxt/test-utils/e2e';
import type { Page } from 'playwright-core';
import type { JsonObject } from '@osi/remote-trackers/contracts';
import { url } from '../helpers/url';
import { requireBrowser } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedUser } from '../helpers/seed';
import { loginAs } from '../helpers/ui';
import { setupServer } from '../harness/setup-server';
import { apiLogin } from '../helpers/auth';
import { createTracker } from '../helpers/http';

const describeClientReportUi = requireBrowser();

const OPENPROJECT = 'https://op.client-report.example.com';
const REDMINE = 'https://redmine.client-report.example.com';

async function fulfillJson(page: Page, pattern: string, body: JsonObject) {
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** One OpenProject log (title from the entity link) and one Redmine log (title by lookup). */
async function mockTrackers(page: Page) {
  await fulfillJson(page, `${OPENPROJECT}/api/v3/time_entries**`, {
    _embedded: {
      elements: [
        {
          id: 501,
          spentOn: '2026-09-01',
          hours: 'PT3H30M',
          comment: { raw: 'Paginacja i filtry listy faktur' },
          _links: {
            entity: { href: '/api/v3/work_packages/4821', title: 'Portal klienta: lista faktur' },
            activity: { href: '/api/v3/time_entries/activities/1', title: 'Development' },
            user: { href: '/api/v3/users/7' },
          },
        },
      ],
    },
  });
  await fulfillJson(page, `${REDMINE}/time_entries.json**`, {
    time_entries: [
      {
        id: 9001,
        spent_on: '2026-09-02',
        hours: 0.5,
        comments: 'Standup',
        issue: { id: 112 },
        activity: { id: 9, name: 'Meeting' },
        user: { id: 3 },
      },
    ],
    total_count: 1,
    offset: 0,
    limit: 100,
  });
  await fulfillJson(page, `${REDMINE}/issues.json**`, {
    issues: [{ id: 112, subject: 'Spotkania zespołu' }],
  });
}

describeClientReportUi('client report UI', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl, browser: true });

  it('exports a PDF for a new preset and preselects it after a reload', async () => {
    const user = await seedUser(dbUrl);
    const { jar, token } = await apiLogin(user.email, user.password);
    const openProject = await createTracker(jar, token, 'Helios OpenProject', {
      baseUrl: OPENPROJECT,
    });
    const redmine = await createTracker(jar, token, 'Helios Redmine', {
      systemType: 'redmine',
      baseUrl: REDMINE,
    });

    const page = await createPage('/');
    await loginAs(page, user.email);
    await mockTrackers(page);
    await page.evaluate(
      ({ ids }) => {
        for (const id of ids) window.localStorage.setItem(`rsc:${id}`, 'e2e-secret');
      },
      { ids: [openProject.id, redmine.id] },
    );

    // Interacting before hydration would submit the form natively.
    await page.goto(url('/reports/client?month=2026-09'), { waitUntil: 'hydration' });
    await page.waitForSelector('[data-testid="client-report-form"]');
    await page.fill('input[data-testid="client-report-client-name"]', 'Helios Energy');
    await page.getByRole('checkbox', { name: 'Helios OpenProject' }).click();
    await page.getByRole('checkbox', { name: 'Helios Redmine' }).click();

    // A new preset is saved by the export, and the action says so.
    expect(await page.textContent('[data-testid="client-report-export"]')).toContain(
      'Save and export PDF',
    );

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="client-report-export"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/^[a-z-]+-helios-energy-2026-09\.pdf$/);
    const path = await download.path();
    const bytes = await readFile(path);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    await page.goto(url('/reports/client?month=2026-09'), { waitUntil: 'hydration' });
    expect(await page.inputValue('input[data-testid="client-report-client-name"]')).toBe(
      'Helios Energy',
    );
    expect(
      await page.getByRole('checkbox', { name: 'Helios Redmine' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect((await page.textContent('[data-testid="client-report-export"]'))?.trim()).toBe(
      'Export PDF',
    );
  });
});
