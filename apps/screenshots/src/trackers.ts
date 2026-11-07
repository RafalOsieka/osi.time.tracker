// Fake OpenProject and Redmine for the screenshot walk: tracker calls run in the browser, so the
// context answers them before they leave it. The answers match the seeded Tasks, so the Remote sync
// and client report screens show logs already in the tracker. A request no handler knows gets a
// 404 and a warning, so a new tracker call shows up in the capture's output.
import type { BrowserContext, Page, Route } from 'playwright';
import { TASKS, TRACKERS } from './seed.js';

/** The JSON body for a tracker request, or `undefined` when the fake doesn't know it. */
type Handler = (url: URL, day: string) => object | undefined;

const openProject: Handler = (url, day) => {
  const path = url.pathname;
  if (path === '/api/v3/time_entries/form') {
    return {
      _embedded: {
        schema: {
          activity: {
            _embedded: {
              allowedValues: [
                { id: 1, name: 'Development' },
                { id: 2, name: 'Meeting' },
                { id: 3, name: 'Testing' },
              ],
            },
          },
        },
      },
    };
  }
  if (path === '/api/v3/time_entries') {
    const log = (
      id: number,
      issue: { id: string; title: string },
      hours: string,
      activity: string,
    ) => {
      const workPackage = { href: `/api/v3/work_packages/${issue.id}`, title: issue.title };
      return {
        id,
        spentOn: day,
        hours,
        comment: { raw: issue.title },
        _links: {
          entity: workPackage,
          workPackage,
          activity: { href: '/api/v3/time_entries/activities/1', title: activity },
          user: { href: '/api/v3/users/7' },
        },
      };
    };
    const elements = [
      log(501, TASKS.invoices.issue, 'PT2H', 'Development'),
      log(502, TASKS.standup.issue, 'PT15M', 'Meeting'),
    ];
    return { _embedded: { elements }, total: elements.length, count: elements.length };
  }
  if (path === '/api/v3/users/me') return { id: 7, name: 'Ada Kowalska' };
  if (path === '/api/v3/projects') {
    const elements = [
      { id: 10, name: 'Acme' },
      { id: 11, name: 'Client Portal', _links: { parent: { href: '/api/v3/projects/10' } } },
      { id: 12, name: 'Mobile App', _links: { parent: { href: '/api/v3/projects/10' } } },
    ];
    return { _embedded: { elements }, total: elements.length, count: elements.length };
  }
  if (path === '/api/v3/work_packages') {
    const project = { href: '/api/v3/projects/12', title: 'Acme Mobile App' };
    const elements = [
      { id: 5230, subject: 'Release 2.4: smoke test checklist', _links: { project } },
      { id: 5231, subject: 'Release 2.4: store listing and screenshots', _links: { project } },
      { id: 5198, subject: 'Release 2.3 hotfix: login on iOS 19', _links: { project } },
    ];
    return { _embedded: { elements }, total: elements.length, count: elements.length };
  }
  return undefined;
};

const redmine: Handler = (url, day) => {
  const path = url.pathname;
  if (path === '/enumerations/time_entry_activities.json') {
    return {
      time_entry_activities: [
        { id: 9, name: 'Development', is_default: true },
        { id: 10, name: 'Meeting', is_default: false },
      ],
    };
  }
  if (path === '/time_entries.json') {
    return {
      time_entries: [
        {
          id: 9001,
          spent_on: day,
          hours: 0.75,
          comments: TASKS.csv.title,
          issue: { id: Number(TASKS.csv.issue.id) },
          activity: { id: 9, name: 'Development' },
          user: { id: 3 },
        },
      ],
      total_count: 1,
      offset: 0,
      limit: 100,
    };
  }
  if (path === '/issues.json') {
    return { issues: [{ id: Number(TASKS.csv.issue.id), subject: TASKS.csv.issue.title }] };
  }
  if (path === '/users/current.json') {
    return { user: { id: 3, login: 'ada', firstname: 'Ada', lastname: 'Kowalska' } };
  }
  return undefined;
};

/** Answers both seeded Trackers in `context`, with remote logs on `day`. */
export async function mockTrackers(context: BrowserContext, day: string): Promise<void> {
  const serve = (handler: Handler) => async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = handler(url, day);
    if (body === undefined) {
      console.warn(`Unmocked tracker call: ${request.method()} ${url.href}`);
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  };
  await context.route(`${TRACKERS.acme.baseUrl}/**`, serve(openProject));
  await context.route(`${TRACKERS.globex.baseUrl}/**`, serve(redmine));
}

/** Makes both Trackers fail on `page`; a page's routes take precedence over its context's. */
export async function failTrackers(page: Page): Promise<void> {
  for (const { baseUrl } of Object.values(TRACKERS)) {
    await page.route(`${baseUrl}/**`, (route) =>
      route.fulfill({ status: 503, contentType: 'text/plain', body: 'Service Unavailable' }),
    );
  }
}
