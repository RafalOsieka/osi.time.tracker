import type { IssueFixture, ProjectFixture, TrackerKey } from './fixture/types.js';
import type { GeneratedLog } from './generator/logs.js';
import type {
  Operation,
  Plan,
  RemoteLogState,
  RemoteProjectState,
  RemoteState,
} from './planner.js';

/** Provider-specific side of the seed: reading state and applying operations. */
export interface OperationHandlers {
  deleteDemoProject(project: RemoteProjectState): Promise<void>;
  createProject(project: ProjectFixture): Promise<void>;
  createIssue(projectIdentifier: string, issue: IssueFixture, close: boolean): Promise<void>;
  deleteLog(log: RemoteLogState): Promise<void>;
  createLog(log: GeneratedLog): Promise<void>;
}

export interface TrackerSeeder {
  tracker: TrackerKey;
  /** Reads current state; `from`/`to` bound the admin time-log window. */
  readState(window: { from: string; to: string }): Promise<RemoteState>;
  handlers: OperationHandlers;
  /** Parallelism for time-log operations (creates and deletes). */
  logConcurrency: number;
}

export class SeedStepError extends Error {
  constructor(
    readonly tracker: TrackerKey,
    readonly step: string,
    override readonly cause: Error,
  ) {
    super(`${tracker}: ${step} failed: ${cause.message}`);
    this.name = 'SeedStepError';
  }
}

export interface ExecutionSummary {
  created: { projects: number; issues: number; logs: number };
  deleted: { demoProjects: number; logs: number };
}

export function describeOperation(operation: Operation): string {
  switch (operation.kind) {
    case 'deleteDemoProject':
      return `delete demo project ${operation.project.identifier}`;
    case 'createProject':
      return `create project ${operation.project.identifier}`;
    case 'createIssue':
      return `create issue [${operation.projectIdentifier}] ${operation.issue.subject}`;
    case 'deleteLog':
      return `delete log ${operation.log.remoteLogId} (${operation.log.spentOn})`;
    case 'createLog':
      return `create log ${operation.log.spentOn} [${operation.log.projectIdentifier}] ${operation.log.issueSubject}`;
  }
}

async function applyOperation(handlers: OperationHandlers, operation: Operation): Promise<void> {
  switch (operation.kind) {
    case 'deleteDemoProject':
      return handlers.deleteDemoProject(operation.project);
    case 'createProject':
      return handlers.createProject(operation.project);
    case 'createIssue':
      return handlers.createIssue(operation.projectIdentifier, operation.issue, operation.close);
    case 'deleteLog':
      return handlers.deleteLog(operation.log);
    case 'createLog':
      return handlers.createLog(operation.log);
  }
}

/**
 * Applies a plan in order. Structural operations run one at a time; runs of
 * consecutive time-log operations run with `logConcurrency` workers. The
 * first failure stops this tracker and surfaces the failing step.
 */
export async function executePlan(
  plan: Plan,
  seeder: TrackerSeeder,
  report: (line: string) => void,
): Promise<ExecutionSummary> {
  const summary: ExecutionSummary = {
    created: { projects: 0, issues: 0, logs: 0 },
    deleted: { demoProjects: 0, logs: 0 },
  };
  const count = (operation: Operation) => {
    switch (operation.kind) {
      case 'deleteDemoProject':
        summary.deleted.demoProjects += 1;
        break;
      case 'createProject':
        summary.created.projects += 1;
        break;
      case 'createIssue':
        summary.created.issues += 1;
        break;
      case 'deleteLog':
        summary.deleted.logs += 1;
        break;
      case 'createLog':
        summary.created.logs += 1;
        break;
    }
  };

  const operations = plan.operations;
  let index = 0;
  while (index < operations.length) {
    const operation = operations[index];
    if (!operation) break;
    const isLogOperation = operation.kind === 'createLog' || operation.kind === 'deleteLog';
    if (!isLogOperation) {
      report(`${plan.tracker}: ${describeOperation(operation)}`);
      try {
        await applyOperation(seeder.handlers, operation);
      } catch (err) {
        throw new SeedStepError(
          plan.tracker,
          describeOperation(operation),
          err instanceof Error ? err : new Error(String(err)),
        );
      }
      count(operation);
      index += 1;
      continue;
    }

    let end = index;
    while (end < operations.length && operations[end]?.kind === operation.kind) end += 1;
    const batch = operations.slice(index, end);
    report(
      `${plan.tracker}: ${operation.kind === 'createLog' ? 'creating' : 'deleting'} ${batch.length} log(s)`,
    );
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < batch.length) {
        const current = batch[next];
        next += 1;
        if (!current) return;
        try {
          await applyOperation(seeder.handlers, current);
        } catch (err) {
          throw new SeedStepError(
            plan.tracker,
            describeOperation(current),
            err instanceof Error ? err : new Error(String(err)),
          );
        }
        count(current);
        done += 1;
        if (done % 25 === 0 || done === batch.length) {
          report(`${plan.tracker}:   ${done}/${batch.length}`);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(seeder.logConcurrency, batch.length)) }, worker),
    );
    index = end;
  }
  return summary;
}
