import type { SeedEnv } from './env.js';
import { executePlan, type TrackerSeeder } from './executor.js';
import type { ClientFixture, TrackerKey } from './fixture/types.js';
import { formatIsoDate, parseIsoDate, RANGE_DAYS } from './generator/calendar.js';
import type { GeneratedLog } from './generator/logs.js';
import { describePlan, planTracker } from './planner.js';

export interface SeedOptions {
  dryRun: boolean;
  reset: boolean;
}

/** Everything the orchestration needs, injected so the flow is testable without Docker or HTTP. */
export interface SeedDeps {
  env: SeedEnv;
  /** `YYYY-MM-DD` of the run; logs cover the 91 days before it. */
  runDate: string;
  fixtures: readonly ClientFixture[];
  generateLogs: (runDate: string, fixtures: readonly ClientFixture[]) => GeneratedLog[];
  waitForTrackers: () => Promise<void>;
  /** Per-tracker account bootstrap; resolves with a short status line. */
  bootstrap: Record<TrackerKey, () => Promise<string>>;
  seeders: Record<TrackerKey, TrackerSeeder>;
  report: (line: string) => void;
}

export interface SeedOutcome {
  exitCode: 0 | 1;
  failures: string[];
}

/** Extra days read back before the range so `--reset` also finds logs from earlier frames. */
const READ_BACK_DAYS = RANGE_DAYS + 35;

/**
 * The seed flow (REQ-347): wait for healthchecks, then per tracker bootstrap,
 * read state, plan and (unless dry-run) execute. Trackers are isolated: a
 * failure on one is reported and the other still runs; the exit code is 1
 * when anything failed. Ends with the base URLs and keys to paste into OSI.
 */
export async function runSeed(options: SeedOptions, deps: SeedDeps): Promise<SeedOutcome> {
  const { report } = deps;
  const failures: string[] = [];

  try {
    await deps.waitForTrackers();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report(message);
    return { exitCode: 1, failures: [message] };
  }

  const logs = deps.generateLogs(deps.runDate, deps.fixtures);
  const run = parseIsoDate(deps.runDate);
  const window = {
    from: formatIsoDate(run - READ_BACK_DAYS * 24 * 60 * 60 * 1000),
    to: deps.runDate,
  };

  for (const fixture of deps.fixtures) {
    const tracker = fixture.tracker;
    try {
      report(`${tracker}: ${await deps.bootstrap[tracker]()}`);
      const seeder = deps.seeders[tracker];
      report(`${tracker}: reading current state`);
      const state = await seeder.readState(window);
      const plan = planTracker(fixture, logs, state, { reset: options.reset });
      const lines = describePlan(plan);
      if (options.dryRun) {
        for (const line of lines) report(line);
        continue;
      }
      report(lines[0] ?? '');
      report(lines[1] ?? '');
      const summary = await executePlan(plan, seeder, report);
      report(
        `${tracker}: done — created ${summary.created.projects} project(s), ` +
          `${summary.created.issues} issue(s), ${summary.created.logs} log(s); ` +
          `deleted ${summary.deleted.demoProjects} demo project(s), ${summary.deleted.logs} log(s)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(message);
      report(`${tracker}: FAILED — ${message}`);
    }
  }

  report('');
  report(options.dryRun ? 'Dry run: nothing was written.' : 'Paste into the OSI tracker form:');
  report(`  Redmine      ${deps.env.redmine.baseUrl}  API key: ${deps.env.redmine.apiKey}`);
  report(`  OpenProject  ${deps.env.openProject.baseUrl}  API key: ${deps.env.openProject.apiKey}`);
  if (failures.length > 0) {
    report('');
    report(
      `${failures.length} tracker(s) failed; re-run after fixing the cause (the seed is idempotent).`,
    );
  }
  return { exitCode: failures.length > 0 ? 1 : 0, failures };
}
