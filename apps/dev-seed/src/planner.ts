import type { ClientFixture, IssueFixture, ProjectFixture } from './fixture/types.js';
import { projectsWithIssues } from './fixture/index.js';
import type { GeneratedLog } from './generator/logs.js';

/** Tracker state relevant to the seed, read before planning (provider-neutral). */
export interface RemoteProjectState {
  identifier: string;
  remoteId: string;
}

export interface RemoteIssueState {
  remoteId: string;
  projectIdentifier: string;
  subject: string;
}

export interface RemoteLogState {
  remoteLogId: string;
  issueRemoteId: string;
  /** `YYYY-MM-DD` */
  spentOn: string;
  /** Normalized: trimmed, blank → `null`. */
  comment: string | null;
}

export interface RemoteState {
  projects: RemoteProjectState[];
  issues: RemoteIssueState[];
  /** The admin account's logs in the read window. */
  logs: RemoteLogState[];
  /** Stock projects to remove (OpenProject demo data); empty when absent. */
  demoProjects: RemoteProjectState[];
}

export type Operation =
  | { kind: 'deleteDemoProject'; project: RemoteProjectState }
  | { kind: 'createProject'; project: ProjectFixture }
  | { kind: 'createIssue'; projectIdentifier: string; issue: IssueFixture; close: boolean }
  | { kind: 'deleteLog'; log: RemoteLogState; projectIdentifier: string; issueSubject: string }
  | { kind: 'createLog'; log: GeneratedLog };

export interface Plan {
  tracker: ClientFixture['tracker'];
  operations: Operation[];
  skipped: { projects: number; issues: number; logs: number };
}

export interface PlanOptions {
  reset: boolean;
}

/** Idempotency key of a log: issue + day + normalized comment (REQ-352). */
export function logKey(
  projectIdentifier: string,
  issueSubject: string,
  spentOn: string,
  comment: string | null,
): string {
  return `${projectIdentifier}|${issueSubject}|${spentOn}|${comment ?? ''}`;
}

export function normalizeComment(comment: string | null | undefined): string | null {
  const trimmed = comment?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function isFixtureComment(issue: IssueFixture, comment: string | null): boolean {
  if (comment === null) return true;
  return issue.comments.some((known) => comment === known || comment.startsWith(known));
}

/**
 * Turns fixture + generated logs + current tracker state into ordered
 * operations. Existing projects, issues and logs are skipped, never updated;
 * with `reset`, the admin's logs on fixture issues carrying fixture comments
 * are deleted first so they can be recreated (design.md — D5).
 */
export function planTracker(
  fixture: ClientFixture,
  logs: GeneratedLog[],
  state: RemoteState,
  options: PlanOptions,
): Plan {
  const operations: Operation[] = [];
  const skipped = { projects: 0, issues: 0, logs: 0 };

  for (const demo of state.demoProjects) {
    operations.push({ kind: 'deleteDemoProject', project: demo });
  }

  const existingProjects = new Set(state.projects.map((project) => project.identifier));
  for (const project of fixture.projects) {
    if (existingProjects.has(project.identifier)) skipped.projects += 1;
    else operations.push({ kind: 'createProject', project });
  }

  const existingIssues = new Set(
    state.issues.map((issue) => `${issue.projectIdentifier}|${issue.subject}`),
  );
  for (const project of projectsWithIssues(fixture)) {
    for (const issue of project.issues) {
      if (existingIssues.has(`${project.identifier}|${issue.subject}`)) skipped.issues += 1;
      else {
        operations.push({
          kind: 'createIssue',
          projectIdentifier: project.identifier,
          issue,
          close: issue.arc === 'closed-early' || issue.arc === 'closed-mid',
        });
      }
    }
  }

  const issueByRemoteId = new Map(state.issues.map((issue) => [issue.remoteId, issue]));
  const fixtureIssue = (projectIdentifier: string, subject: string) =>
    fixture.projects
      .find((project) => project.identifier === projectIdentifier)
      ?.issues.find((issue) => issue.subject === subject) ?? null;

  const existingLogKeys = new Set<string>();
  for (const log of state.logs) {
    const issue = issueByRemoteId.get(log.issueRemoteId);
    if (!issue) continue;
    const key = logKey(issue.projectIdentifier, issue.subject, log.spentOn, log.comment);
    const known = fixtureIssue(issue.projectIdentifier, issue.subject);
    if (options.reset && known && isFixtureComment(known, log.comment)) {
      operations.push({
        kind: 'deleteLog',
        log,
        projectIdentifier: issue.projectIdentifier,
        issueSubject: issue.subject,
      });
    } else {
      existingLogKeys.add(key);
    }
  }

  const sortedLogs = [...logs].sort((a, b) => a.spentOn.localeCompare(b.spentOn));
  for (const log of sortedLogs) {
    if (log.tracker !== fixture.tracker) continue;
    const key = logKey(log.projectIdentifier, log.issueSubject, log.spentOn, log.comment);
    if (existingLogKeys.has(key)) skipped.logs += 1;
    else operations.push({ kind: 'createLog', log });
  }

  return { tracker: fixture.tracker, operations, skipped };
}

/** Human-readable plan lines for `--dry-run` and progress output. */
export function describePlan(plan: Plan): string[] {
  const count = (kind: Operation['kind']) =>
    plan.operations.filter((operation) => operation.kind === kind).length;
  const lines = [
    `${plan.tracker}: ${count('deleteDemoProject')} demo project(s) to delete, ` +
      `${count('createProject')} project(s), ${count('createIssue')} issue(s), ` +
      `${count('deleteLog')} log(s) to delete, ${count('createLog')} log(s) to create`,
    `${plan.tracker}: skipping ${plan.skipped.projects} existing project(s), ` +
      `${plan.skipped.issues} issue(s), ${plan.skipped.logs} log(s)`,
  ];
  for (const operation of plan.operations) {
    switch (operation.kind) {
      case 'deleteDemoProject':
        lines.push(`  - delete demo project ${operation.project.identifier}`);
        break;
      case 'createProject':
        lines.push(
          `  + project ${operation.project.identifier}` +
            (operation.project.parent ? ` (under ${operation.project.parent})` : ''),
        );
        break;
      case 'createIssue':
        lines.push(
          `  + issue [${operation.projectIdentifier}] ${operation.issue.subject}` +
            (operation.close ? ' (closed)' : ''),
        );
        break;
      case 'deleteLog':
        lines.push(
          `  - log ${operation.log.spentOn} [${operation.projectIdentifier}] ${operation.issueSubject}: ${operation.log.comment ?? '<blank>'}`,
        );
        break;
      case 'createLog':
        lines.push(
          `  + log ${operation.log.spentOn} [${operation.log.projectIdentifier}] ` +
            `${operation.log.issueSubject}: ${operation.log.comment ?? '<blank>'} ` +
            `(${(operation.log.durationSeconds / 3600).toFixed(2)} h)`,
        );
        break;
    }
  }
  return lines;
}
