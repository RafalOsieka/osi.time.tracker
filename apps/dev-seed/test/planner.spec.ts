import { describe, expect, it } from 'vitest';
import { NORDWIND, projectsWithIssues } from '../src/fixture/index.js';
import { generateLogs, type GeneratedLog } from '../src/generator/logs.js';
import {
  describePlan,
  normalizeComment,
  planTracker,
  type Operation,
  type RemoteState,
} from '../src/planner.js';

const RUN_DATE = '2026-09-16';
const allLogs = generateLogs(RUN_DATE, [NORDWIND]);

const emptyState = (): RemoteState => ({ projects: [], issues: [], logs: [], demoProjects: [] });

/** A state in which the whole fixture (and every generated log) already exists. */
function seededState(logs: GeneratedLog[]): RemoteState {
  const projects = NORDWIND.projects.map((project, index) => ({
    identifier: project.identifier,
    remoteId: `p${index + 1}`,
  }));
  const issues = projectsWithIssues(NORDWIND).flatMap((project) =>
    project.issues.map((issue, index) => ({
      remoteId: `${project.identifier}#${index + 1}`,
      projectIdentifier: project.identifier,
      subject: issue.subject,
    })),
  );
  const remoteIdOf = (log: GeneratedLog) =>
    issues.find(
      (issue) =>
        issue.projectIdentifier === log.projectIdentifier && issue.subject === log.issueSubject,
    )?.remoteId ?? 'missing';
  return {
    projects,
    issues,
    logs: logs.map((log, index) => ({
      remoteLogId: `t${index + 1}`,
      issueRemoteId: remoteIdOf(log),
      spentOn: log.spentOn,
      comment: log.comment,
    })),
    demoProjects: [],
  };
}

const kinds = (operations: Operation[]) =>
  operations.reduce<Record<string, number>>((acc, operation) => {
    acc[operation.kind] = (acc[operation.kind] ?? 0) + 1;
    return acc;
  }, {});

describe('planTracker', () => {
  it('plans the whole fixture on a fresh tracker, projects before issues before logs', () => {
    const plan = planTracker(NORDWIND, allLogs, emptyState(), { reset: false });
    expect(kinds(plan.operations)).toEqual({
      createProject: NORDWIND.projects.length,
      createIssue: projectsWithIssues(NORDWIND).reduce((sum, p) => sum + p.issues.length, 0),
      createLog: allLogs.length,
    });
    const order = plan.operations.map((operation) => operation.kind);
    expect(order.indexOf('createIssue')).toBeGreaterThan(order.lastIndexOf('createProject'));
    expect(order.indexOf('createLog')).toBeGreaterThan(order.lastIndexOf('createIssue'));
    expect(plan.skipped).toEqual({ projects: 0, issues: 0, logs: 0 });
    // Parents are created before their children.
    const created = plan.operations.flatMap((operation) =>
      operation.kind === 'createProject' ? [operation.project] : [],
    );
    for (const [index, project] of created.entries()) {
      if (project.parent === null) continue;
      expect(
        created.findIndex((candidate) => candidate.identifier === project.parent),
      ).toBeLessThan(index);
    }
  });

  it('closes only the issues whose arc is closed', () => {
    const plan = planTracker(NORDWIND, [], emptyState(), { reset: false });
    for (const operation of plan.operations) {
      if (operation.kind !== 'createIssue') continue;
      const closedArc =
        operation.issue.arc === 'closed-early' || operation.issue.arc === 'closed-mid';
      expect(operation.close).toBe(closedArc);
    }
  });

  it('is a no-op on a fully seeded tracker', () => {
    const plan = planTracker(NORDWIND, allLogs, seededState(allLogs), { reset: false });
    expect(plan.operations).toEqual([]);
    expect(plan.skipped).toEqual({
      projects: NORDWIND.projects.length,
      issues: projectsWithIssues(NORDWIND).reduce((sum, p) => sum + p.issues.length, 0),
      logs: allLogs.length,
    });
  });

  it('creates only the missing day when the window slid inside the week', () => {
    // Tuesday run seeded through Monday (a Redmine day); Wednesday adds Tuesday.
    const tuesday = generateLogs('2026-09-15', [NORDWIND]);
    const wednesday = generateLogs('2026-09-16', [NORDWIND]);
    const plan = planTracker(NORDWIND, wednesday, seededState(tuesday), { reset: false });
    expect(plan.operations.every((operation) => operation.kind === 'createLog')).toBe(true);
    expect(
      plan.operations.every(
        (operation) => operation.kind === 'createLog' && operation.log.spentOn === '2026-09-15',
      ),
    ).toBe(true);
    expect(plan.operations.length).toBeGreaterThan(0);
  });

  it('leaves hand-made projects, issues and logs alone and never reverts a status', () => {
    const state = seededState(allLogs);
    state.projects.push({ identifier: 'my-own', remoteId: 'p99' });
    state.issues.push({
      remoteId: 'x1',
      projectIdentifier: 'dispatch-web',
      subject: 'My own issue',
    });
    state.logs.push({
      remoteLogId: 't999',
      issueRemoteId: 'dispatch-web#1',
      spentOn: '2026-09-01',
      comment: 'Something I typed by hand',
    });
    const plan = planTracker(NORDWIND, allLogs, state, { reset: true });
    expect(plan.operations.some((operation) => operation.kind === 'createProject')).toBe(false);
    expect(plan.operations.some((operation) => operation.kind === 'createIssue')).toBe(false);
    expect(
      plan.operations.some(
        (operation) => operation.kind === 'deleteLog' && operation.log.remoteLogId === 't999',
      ),
    ).toBe(false);
    // Nothing in the plan touches statuses of existing issues.
    expect(plan.operations.every((operation) => operation.kind !== 'createIssue')).toBe(true);
  });

  it('with --reset deletes only fixture logs (by issue and fixture comment) and recreates them', () => {
    const state = seededState(allLogs);
    state.logs.push({
      remoteLogId: 't998',
      issueRemoteId: 'dispatch-web#1',
      spentOn: '2026-07-01',
      comment: null,
    });
    const plan = planTracker(NORDWIND, allLogs, state, { reset: true });
    const deleted = plan.operations.filter((operation) => operation.kind === 'deleteLog');
    // Every seeded log plus the blank-comment one on a fixture issue.
    expect(deleted).toHaveLength(allLogs.length + 1);
    const created = plan.operations.filter((operation) => operation.kind === 'createLog');
    expect(created).toHaveLength(allLogs.length);
    const order = plan.operations.map((operation) => operation.kind);
    expect(order.indexOf('createLog')).toBeGreaterThan(order.lastIndexOf('deleteLog'));
  });

  it('deletes demo projects first and skips them once gone', () => {
    const state = emptyState();
    state.demoProjects = [{ identifier: 'demo-project', remoteId: '1' }];
    const plan = planTracker(NORDWIND, [], state, { reset: false });
    expect(plan.operations[0]).toEqual({
      kind: 'deleteDemoProject',
      project: { identifier: 'demo-project', remoteId: '1' },
    });
    const again = planTracker(NORDWIND, [], emptyState(), { reset: false });
    expect(again.operations.some((operation) => operation.kind === 'deleteDemoProject')).toBe(
      false,
    );
  });

  it('describes the plan with counts and one line per operation', () => {
    const plan = planTracker(NORDWIND, allLogs.slice(0, 2), emptyState(), { reset: false });
    const lines = describePlan(plan);
    expect(lines[0]).toMatch(
      /^redmine: 0 demo project\(s\) to delete, \d+ project\(s\), \d+ issue\(s\), 0 log\(s\) to delete, 2 log\(s\) to create$/,
    );
    expect(lines).toHaveLength(2 + plan.operations.length);
    expect(lines.some((line) => line.startsWith('  + project fleet-platform'))).toBe(true);
    expect(lines.some((line) => line.includes('(closed)'))).toBe(true);
  });

  it('normalizes blank comments to null', () => {
    expect(normalizeComment('  ')).toBeNull();
    expect(normalizeComment(undefined)).toBeNull();
    expect(normalizeComment(' note ')).toBe('note');
  });
});
