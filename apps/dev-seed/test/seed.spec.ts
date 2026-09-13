import { describe, expect, it } from 'vitest';
import type { TrackerSeeder } from '../src/executor.js';
import { CLIENT_FIXTURES } from '../src/fixture/index.js';
import type { TrackerKey } from '../src/fixture/types.js';
import type { GeneratedLog } from '../src/generator/logs.js';
import type { RemoteState } from '../src/planner.js';
import { runSeed, type SeedDeps } from '../src/seed.js';

const env = {
  openProject: { baseUrl: 'http://localhost:8090', apiKey: 'op-key' },
  redmine: { baseUrl: 'http://localhost:8091', apiKey: 'rm-key', adminPassword: 'admin' },
};

interface FakeSeederLog {
  reads: { from: string; to: string }[];
  created: string[];
}

function fakeSeeder(tracker: TrackerKey, log: FakeSeederLog, failOn?: string): TrackerSeeder {
  const empty: RemoteState = { projects: [], issues: [], logs: [], demoProjects: [] };
  return {
    tracker,
    logConcurrency: 2,
    readState: async (window) => {
      log.reads.push(window);
      return empty;
    },
    handlers: {
      deleteDemoProject: async () => {},
      createProject: async (project) => {
        if (project.identifier === failOn) throw new Error('boom');
        log.created.push(`project ${project.identifier}`);
      },
      createIssue: async (projectIdentifier, issue) => {
        log.created.push(`issue ${projectIdentifier}/${issue.subject}`);
      },
      deleteLog: async () => {},
      createLog: async (entry) => {
        log.created.push(`log ${entry.spentOn}`);
      },
    },
  };
}

const oneLogPerTracker: GeneratedLog[] = [
  {
    tracker: 'redmine',
    spentOn: '2026-09-10',
    projectIdentifier: 'dispatch-web',
    issueSubject: 'Route planner: drag-to-reorder stops',
    activityIndex: 0,
    durationSeconds: 3600,
    comment: 'x',
  },
  {
    tracker: 'openproject',
    spentOn: '2026-09-11',
    projectIdentifier: 'customer-web',
    issueSubject: 'Live yield chart with 15-minute buckets',
    activityIndex: 0,
    durationSeconds: 3600,
    comment: 'y',
  },
];

function deps(overrides: Partial<SeedDeps>, logs: Record<TrackerKey, FakeSeederLog>): SeedDeps {
  const lines: string[] = [];
  return {
    env,
    runDate: '2026-09-13',
    fixtures: CLIENT_FIXTURES,
    generateLogs: () => oneLogPerTracker,
    waitForTrackers: async () => {},
    bootstrap: { redmine: async () => 'ok', openproject: async () => 'ok' },
    seeders: {
      redmine: fakeSeeder('redmine', logs.redmine),
      openproject: fakeSeeder('openproject', logs.openproject),
    },
    report: (line) => {
      lines.push(line);
    },
    ...overrides,
  };
}

const freshLogs = () => {
  const redmine: FakeSeederLog = { reads: [], created: [] };
  const openproject: FakeSeederLog = { reads: [], created: [] };
  return { redmine, openproject };
};

describe('runSeed', () => {
  it('seeds both trackers and prints the keys', async () => {
    const logs = freshLogs();
    const lines: string[] = [];
    const outcome = await runSeed(
      { dryRun: false, reset: false },
      deps({ report: (line) => lines.push(line) }, logs),
    );
    expect(outcome).toEqual({ exitCode: 0, failures: [] });
    expect(logs.redmine.created.filter((entry) => entry.startsWith('project '))).toHaveLength(9);
    expect(logs.redmine.created).toContain('log 2026-09-10');
    expect(logs.openproject.created).toContain('log 2026-09-11');
    // State is read back further than the range so --reset finds older fixture logs.
    expect(logs.redmine.reads).toEqual([{ from: '2026-05-10', to: '2026-09-13' }]);
    expect(lines.at(-2)).toContain('rm-key');
    expect(lines.at(-1)).toContain('op-key');
    expect(lines.some((line) => line.startsWith('redmine: done'))).toBe(true);
  });

  it('keeps going when one tracker fails and exits non-zero naming the step', async () => {
    const logs = freshLogs();
    const lines: string[] = [];
    const outcome = await runSeed(
      { dryRun: false, reset: false },
      deps(
        {
          report: (line) => lines.push(line),
          seeders: {
            redmine: fakeSeeder('redmine', logs.redmine, 'dispatch'),
            openproject: fakeSeeder('openproject', logs.openproject),
          },
        },
        logs,
      ),
    );
    expect(outcome.exitCode).toBe(1);
    expect(outcome.failures).toEqual(['redmine: create project dispatch failed: boom']);
    expect(logs.redmine.created).toEqual(['project fleet-platform']);
    expect(logs.openproject.created.length).toBeGreaterThan(40);
    expect(lines.some((line) => line.startsWith('redmine: FAILED'))).toBe(true);
    expect(lines.at(-1)).toMatch(/1 tracker\(s\) failed/);
  });

  it('reports a bootstrap failure without reading or writing that tracker', async () => {
    const logs = freshLogs();
    const outcome = await runSeed(
      { dryRun: false, reset: false },
      deps(
        {
          bootstrap: {
            redmine: async () => 'ok',
            openproject: async () => {
              throw new Error('token install failed');
            },
          },
        },
        logs,
      ),
    );
    expect(outcome.exitCode).toBe(1);
    expect(outcome.failures).toEqual(['token install failed']);
    expect(logs.openproject.reads).toEqual([]);
    expect(logs.openproject.created).toEqual([]);
    expect(logs.redmine.created.length).toBeGreaterThan(0);
  });

  it('dry-run prints the plan and writes nothing', async () => {
    const logs = freshLogs();
    const lines: string[] = [];
    const outcome = await runSeed(
      { dryRun: true, reset: false },
      deps({ report: (line) => lines.push(line) }, logs),
    );
    expect(outcome.exitCode).toBe(0);
    expect(logs.redmine.created).toEqual([]);
    expect(logs.openproject.created).toEqual([]);
    expect(lines.some((line) => line === '  + project fleet-platform')).toBe(true);
    expect(lines.some((line) => line.startsWith('Dry run'))).toBe(true);
  });

  it('stops before anything else when the trackers are not healthy', async () => {
    const logs = freshLogs();
    const outcome = await runSeed(
      { dryRun: false, reset: false },
      deps(
        {
          waitForTrackers: async () => {
            throw new Error('redmine is absent');
          },
        },
        logs,
      ),
    );
    expect(outcome).toEqual({ exitCode: 1, failures: ['redmine is absent'] });
    expect(logs.redmine.reads).toEqual([]);
  });
});
