import { describe, expect, it } from 'vitest';
import { executePlan, SeedStepError } from '../src/executor.js';
import { HELIOS } from '../src/fixture/index.js';
import type { GeneratedLog } from '../src/generator/logs.js';
import { createOpenProjectSeeder, workPackageFilters } from '../src/openproject/seeder.js';
import { planTracker } from '../src/planner.js';
import {
  fakeAdapter,
  fakeAdapterState,
  fakeJsonHttp,
  NOT_FOUND,
  type RecordedRequest,
} from './helpers.js';

const BASE = 'http://openproject.test';
const API = `${BASE}/api/v3`;

const statusesRoute = {
  [`GET ${API}/statuses`]: {
    _embedded: {
      elements: [
        { id: 1, name: 'New', isClosed: false },
        { id: 12, name: 'Closed', isClosed: true },
      ],
    },
  },
};

const wpUrl = (projectId: number, offset = 1) =>
  `GET ${API}/projects/${projectId}/work_packages?${new URLSearchParams({
    pageSize: '100',
    offset: String(offset),
    filters: workPackageFilters(),
  })}`;

const projectsUrl = (offset = 1) => `GET ${API}/projects?pageSize=100&offset=${offset}`;

const opActivities = [
  { id: '3', name: 'Development' },
  { id: '2', name: 'Specification' },
  { id: '4', name: 'Testing' },
];

describe('createOpenProjectSeeder', () => {
  it('separates demo projects from the fixture, pages work packages, and reads admin logs', async () => {
    const adapterState = fakeAdapterState({
      activities: opActivities,
      logs: [
        {
          remoteLogId: '9',
          remoteIssueId: '40',
          spentOn: '2026-09-02',
          durationSeconds: 3600,
          activityId: '3',
          activityName: 'Development',
          comment: '',
          remoteUserId: '4',
        },
      ],
    });
    const http = fakeJsonHttp({
      ...statusesRoute,
      [projectsUrl()]: {
        total: 3,
        _embedded: {
          elements: [
            { id: 1, identifier: 'demo-project' },
            { id: 3, identifier: 'solar-portal' },
            { id: 5, identifier: 'customer-web' },
          ],
        },
      },
      [wpUrl(3)]: { total: 0, _embedded: { elements: [] } },
      [wpUrl(5)]: {
        total: 101,
        _embedded: {
          elements: Array.from({ length: 100 }, (_, index) => ({
            id: index + 1000,
            subject: `wp ${index}`,
            lockVersion: 0,
          })),
        },
      },
      [wpUrl(5, 2)]: {
        total: 101,
        _embedded: {
          elements: [
            { id: 40, subject: 'Live yield chart with 15-minute buckets', lockVersion: 2 },
          ],
        },
      },
    });
    const seeder = createOpenProjectSeeder({
      http,
      adapter: fakeAdapter(adapterState),
      baseUrl: BASE,
      fixture: HELIOS,
      sleep: async () => {},
    });

    const state = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });
    expect(state.demoProjects).toEqual([{ identifier: 'demo-project', remoteId: '1' }]);
    expect(state.projects.map((project) => project.identifier)).toEqual([
      'solar-portal',
      'customer-web',
    ]);
    expect(state.issues).toHaveLength(101);
    expect(state.issues.at(-1)).toEqual({
      remoteId: '40',
      projectIdentifier: 'customer-web',
      subject: 'Live yield chart with 15-minute buckets',
    });
    expect(state.logs).toEqual([
      { remoteLogId: '9', issueRemoteId: '40', spentOn: '2026-09-02', comment: null },
    ]);
  });

  it('deletes demo projects with polling, creates projects with parent links, work packages with type, closes with lockVersion, and logs concurrently', async () => {
    const recorded: RecordedRequest[] = [];
    let demoPolls = 0;
    let nextId = 10;
    const http = fakeJsonHttp(
      {
        ...statusesRoute,
        [projectsUrl()]: {
          total: 1,
          _embedded: { elements: [{ id: 1, identifier: 'demo-project' }] },
        },
        [`DELETE ${API}/projects/1`]: {},
        [`GET ${API}/projects/1`]: () => {
          demoPolls += 1;
          return demoPolls < 3 ? { id: 1 } : NOT_FOUND;
        },
        [`POST ${API}/projects`]: () => ({ id: nextId++ }),
        [`POST ${API}/projects/12/work_packages`]: () => ({ id: nextId++, lockVersion: 0 }),
        [`GET ${API}/projects/12/types`]: {
          _embedded: {
            elements: [
              { id: 2, name: 'Milestone' },
              { id: 1, name: 'Task' },
            ],
          },
        },
      },
      recorded,
    );
    const adapterState = fakeAdapterState({ activities: opActivities });
    let inFlight = 0;
    let maxInFlight = 0;
    const adapter = fakeAdapter(adapterState);
    const slowAdapter = {
      ...adapter,
      createTimeEntry: async (input: Parameters<typeof adapter.createTimeEntry>[0]) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return adapter.createTimeEntry(input);
      },
    };
    const seeder = createOpenProjectSeeder({
      http,
      adapter: slowAdapter,
      baseUrl: BASE,
      fixture: HELIOS,
      sleep: async () => {},
    });
    const state = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });

    // Limit the fixture to two projects so the work-package route table stays small.
    const smallFixture = {
      ...HELIOS,
      projects: HELIOS.projects.filter((project) =>
        ['solar-portal', 'customer-app', 'customer-web'].includes(project.identifier),
      ),
    };
    const logs: GeneratedLog[] = Array.from({ length: 10 }, (_, index) => ({
      tracker: 'openproject',
      spentOn: `2026-09-0${(index % 5) + 1}`,
      projectIdentifier: 'customer-web',
      issueSubject: 'Live yield chart with 15-minute buckets',
      activityIndex: 2,
      durationSeconds: 1800,
      comment: `note ${index}`,
    }));
    const plan = planTracker(smallFixture, logs, state, { reset: false });
    const summary = await executePlan(plan, seeder, () => {});

    expect(summary.deleted.demoProjects).toBe(1);
    expect(demoPolls).toBe(3);
    expect(summary.created.projects).toBe(3);
    const projectPosts = recorded.filter(
      (request) => request.method === 'POST' && request.url === `${API}/projects`,
    );
    expect(projectPosts[0]?.body).toEqual({
      identifier: 'solar-portal',
      name: 'Solar Portal',
      _links: {},
    });
    expect(projectPosts[1]?.body).toEqual({
      identifier: 'customer-app',
      name: 'Customer App',
      _links: { parent: { href: '/api/v3/projects/10' } },
    });
    expect(projectPosts[2]?.body).toEqual({
      identifier: 'customer-web',
      name: 'Customer Web',
      _links: { parent: { href: '/api/v3/projects/11' } },
    });

    const wpPosts = recorded.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/work_packages'),
    );
    expect(wpPosts).toHaveLength(7);
    expect(wpPosts[0]?.body).toEqual({
      subject: 'Live yield chart with 15-minute buckets',
      _links: { type: { href: '/api/v3/types/1' } },
    });
    const patches = recorded.filter((request) => request.method === 'PATCH');
    expect(patches).toHaveLength(3);
    expect(patches[0]).toEqual({
      method: 'PATCH',
      url: `${API}/work_packages/13`,
      body: { lockVersion: 0, _links: { status: { href: '/api/v3/statuses/12' } } },
    });

    expect(adapterState.created).toHaveLength(10);
    expect(adapterState.created[0]).toMatchObject({
      remoteIssueId: '13',
      activityId: '4',
      comment: 'note 0',
    });
    expect(maxInFlight).toBe(4);
  });

  it('surfaces a failing work-package creation with tracker and step', async () => {
    const http = fakeJsonHttp({
      ...statusesRoute,
      [projectsUrl()]: {
        total: 1,
        _embedded: { elements: [{ id: 7, identifier: 'grid-analytics' }] },
      },
      [wpUrl(7)]: { total: 0, _embedded: { elements: [] } },
      [`GET ${API}/projects/7/types`]: { _embedded: { elements: [{ id: 1, name: 'Task' }] } },
    });
    const seeder = createOpenProjectSeeder({
      http,
      adapter: fakeAdapter(fakeAdapterState({ activities: opActivities })),
      baseUrl: BASE,
      fixture: HELIOS,
      sleep: async () => {},
    });
    const state = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });
    const fixture = {
      ...HELIOS,
      projects: HELIOS.projects.filter((project) => project.identifier === 'grid-analytics'),
    };
    const plan = planTracker(fixture, [], state, { reset: false });
    const failure = await executePlan(plan, seeder, () => {}).catch((err: Error) => err);
    expect(failure).toBeInstanceOf(SeedStepError);
    expect(String(failure)).toMatch(
      /^SeedStepError: openproject: create issue \[grid-analytics\] Hourly export to the DSO portal failed: work package creation returned no id/,
    );
  });
});
