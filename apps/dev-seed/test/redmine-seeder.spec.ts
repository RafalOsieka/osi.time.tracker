import { describe, expect, it } from 'vitest';
import { executePlan, SeedStepError } from '../src/executor.js';
import { NORDWIND } from '../src/fixture/index.js';
import type { GeneratedLog } from '../src/generator/logs.js';
import { planTracker, type RemoteState } from '../src/planner.js';
import { createRedmineSeeder } from '../src/redmine/seeder.js';
import { fakeAdapter, fakeAdapterState, fakeJsonHttp, type RecordedRequest } from './helpers.js';

const BASE = 'http://redmine.test';

const enumerationRoutes = {
  [`GET ${BASE}/trackers.json`]: {
    trackers: [
      { id: 1, name: 'Bug' },
      { id: 2, name: 'Feature' },
    ],
  },
  [`GET ${BASE}/issue_statuses.json`]: {
    issue_statuses: [
      { id: 1, name: 'New', is_closed: false },
      { id: 5, name: 'Closed', is_closed: true },
    ],
  },
};

const page = (offset: number) => `limit=100&offset=${offset}`;

describe('createRedmineSeeder', () => {
  it('reads projects across pages, issues per fixture project, and admin logs', async () => {
    const adapterState = fakeAdapterState({
      logs: [
        {
          remoteLogId: '77',
          remoteIssueId: '10',
          spentOn: '2026-09-01',
          durationSeconds: 3600,
          activityId: '9',
          activityName: 'Development',
          comment: '  Reorder API + optimistic UI ',
          remoteUserId: '1',
        },
      ],
    });
    const http = fakeJsonHttp({
      ...enumerationRoutes,
      [`GET ${BASE}/projects.json?${page(0)}`]: {
        projects: Array.from({ length: 100 }, (_, index) => ({
          id: index + 100,
          identifier: `other-${index}`,
        })),
        total_count: 102,
      },
      [`GET ${BASE}/projects.json?${page(100)}`]: {
        projects: [
          { id: 1, identifier: 'fleet-platform' },
          { id: 3, identifier: 'dispatch-web', parent: { id: 2 } },
        ],
        total_count: 102,
      },
      [`GET ${BASE}/issues.json?project_id=1&status_id=*&subproject_id=%21*&${page(0)}`]: {
        issues: [],
        total_count: 0,
      },
      [`GET ${BASE}/issues.json?project_id=3&status_id=*&subproject_id=%21*&${page(0)}`]: {
        issues: [{ id: 10, subject: 'Route planner: drag-to-reorder stops' }],
        total_count: 1,
      },
    });
    const seeder = createRedmineSeeder({
      http,
      adapter: fakeAdapter(adapterState),
      baseUrl: BASE,
      fixture: NORDWIND,
    });

    const state = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });
    expect(state.projects).toHaveLength(102);
    expect(state.projects.find((project) => project.identifier === 'dispatch-web')).toEqual({
      identifier: 'dispatch-web',
      remoteId: '3',
    });
    expect(state.issues).toEqual([
      {
        remoteId: '10',
        projectIdentifier: 'dispatch-web',
        subject: 'Route planner: drag-to-reorder stops',
      },
    ]);
    expect(state.logs).toEqual([
      {
        remoteLogId: '77',
        issueRemoteId: '10',
        spentOn: '2026-09-01',
        comment: 'Reorder API + optimistic UI',
      },
    ]);
    expect(state.demoProjects).toEqual([]);
  });

  it('creates projects with numeric parents and modules, issues with closing, and logs via the adapter', async () => {
    const recorded: RecordedRequest[] = [];
    let nextProjectId = 1;
    let nextIssueId = 100;
    const http = fakeJsonHttp(
      {
        ...enumerationRoutes,
        [`GET ${BASE}/projects.json?${page(0)}`]: { projects: [], total_count: 0 },
        [`POST ${BASE}/projects.json`]: () => ({ project: { id: nextProjectId++ } }),
        [`POST ${BASE}/issues.json`]: () => ({ issue: { id: nextIssueId++ } }),
        [`PUT ${BASE}/issues/100.json`]: {},
      },
      recorded,
    );
    const adapterState = fakeAdapterState();
    const seeder = createRedmineSeeder({
      http,
      adapter: fakeAdapter(adapterState),
      baseUrl: BASE,
      fixture: NORDWIND,
    });
    const state = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });

    const log: GeneratedLog = {
      tracker: 'redmine',
      spentOn: '2026-09-01',
      projectIdentifier: 'dispatch-web',
      issueSubject: 'Route planner: drag-to-reorder stops',
      activityIndex: 1,
      durationSeconds: 5400,
      comment: null,
    };
    const plan = planTracker(NORDWIND, [log], state, { reset: false });
    const lines: string[] = [];
    const summary = await executePlan(plan, seeder, (line) => lines.push(line));

    expect(summary.created.projects).toBe(NORDWIND.projects.length);
    const projectPosts = recorded.filter(
      (request) => request.method === 'POST' && request.url.endsWith('/projects.json'),
    );
    expect(projectPosts[0]?.body).toEqual({
      project: {
        name: 'Fleet Platform',
        identifier: 'fleet-platform',
        parent_id: null,
        is_public: true,
        inherit_members: true,
        enabled_module_names: ['issue_tracking', 'time_tracking'],
        tracker_ids: [1, 2],
      },
    });
    const dispatchWeb = projectPosts.find((request) =>
      JSON.stringify(request.body).includes('"identifier":"dispatch-web"'),
    );
    // dispatch-web's parent is dispatch, created second (id 2).
    expect(JSON.stringify(dispatchWeb?.body)).toContain('"parent_id":2');

    const firstIssue = recorded.find(
      (request) => request.method === 'POST' && request.url.endsWith('/issues.json'),
    );
    expect(firstIssue?.body).toEqual({
      issue: { project_id: 3, subject: 'Route planner: drag-to-reorder stops', tracker_id: 2 },
    });
    const closes = recorded.filter((request) => request.method === 'PUT');
    expect(closes[0]).toEqual({
      method: 'PUT',
      url: `${BASE}/issues/100.json`,
      body: { issue: { status_id: 5 } },
    });
    const closedArcs = NORDWIND.projects.flatMap((project) =>
      project.issues.filter((issue) => issue.arc === 'closed-early' || issue.arc === 'closed-mid'),
    );
    expect(closes).toHaveLength(closedArcs.length);

    expect(adapterState.created).toEqual([
      {
        remoteIssueId: '100',
        spentOn: '2026-09-01',
        durationSeconds: 5400,
        activityId: '8',
        comment: undefined,
      },
    ]);
    expect(lines.at(-1)).toBe('redmine:   1/1');
  });

  it('deletes logs through the adapter and surfaces a failing step with tracker and step', async () => {
    const http = fakeJsonHttp({
      ...enumerationRoutes,
      [`GET ${BASE}/projects.json?${page(0)}`]: {
        projects: NORDWIND.projects.map((project, index) => ({
          id: index + 1,
          identifier: project.identifier,
        })),
        total_count: NORDWIND.projects.length,
      },
      ...Object.fromEntries(
        NORDWIND.projects.map((project, index) => [
          `GET ${BASE}/issues.json?project_id=${index + 1}&status_id=*&subproject_id=%21*&${page(0)}`,
          {
            issues: project.issues.map((issue, issueIndex) => ({
              id: index * 100 + issueIndex,
              subject: issue.subject,
            })),
            total_count: project.issues.length,
          },
        ]),
      ),
    });
    const adapterState = fakeAdapterState({
      logs: [
        {
          remoteLogId: '5',
          remoteIssueId: '200',
          spentOn: '2026-08-03',
          durationSeconds: 3600,
          activityId: '9',
          activityName: 'Development',
          comment: 'Reorder API + optimistic UI',
          remoteUserId: '1',
        },
      ],
      createFailure: new Error('Upstream HTTP 422'),
    });
    const seeder = createRedmineSeeder({
      http,
      adapter: fakeAdapter(adapterState),
      baseUrl: BASE,
      fixture: NORDWIND,
    });
    const state: RemoteState = await seeder.readState({ from: '2026-06-01', to: '2026-09-13' });
    expect(state.issues.length).toBeGreaterThan(40);

    const log: GeneratedLog = {
      tracker: 'redmine',
      spentOn: '2026-08-03',
      projectIdentifier: 'dispatch-web',
      issueSubject: 'Route planner: drag-to-reorder stops',
      activityIndex: 0,
      durationSeconds: 3600,
      comment: 'Reorder API + optimistic UI',
    };
    const plan = planTracker(NORDWIND, [log], state, { reset: true });
    expect(plan.operations.map((operation) => operation.kind)).toEqual(['deleteLog', 'createLog']);

    const failure = await executePlan(plan, seeder, () => {}).catch((err: Error) => err);
    expect(adapterState.deleted).toEqual(['5']);
    expect(failure).toBeInstanceOf(SeedStepError);
    expect(String(failure)).toMatch(
      /^SeedStepError: redmine: create log 2026-08-03 \[dispatch-web\] Route planner: drag-to-reorder stops failed: Upstream HTTP 422/,
    );
  });
});
