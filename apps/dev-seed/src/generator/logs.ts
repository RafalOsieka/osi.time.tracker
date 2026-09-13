import { CLIENT_FIXTURES, projectsWithIssues } from '../fixture/index.js';
import type {
  ArcSlot,
  ClientFixture,
  IssueFixture,
  ProjectFixture,
  TrackerKey,
} from '../fixture/types.js';
import { buildCalendar, splitMinutes, type CalendarDay } from './calendar.js';
import { createRng, type Rng } from './random.js';

/** One time log to exist on a tracker; issues are referenced by fixture keys. */
export interface GeneratedLog {
  tracker: TrackerKey;
  /** `YYYY-MM-DD` */
  spentOn: string;
  projectIdentifier: string;
  issueSubject: string;
  /** Index into the client's `activities`. */
  activityIndex: number;
  durationSeconds: number;
  /** `null` is a deliberately blank comment (OSI names that Task `empty`). */
  comment: string | null;
}

/** Arc windows on the 0..1 frame position; overlapping so hand-offs look natural. */
const ARC_WINDOWS = {
  'closed-early': [0, 0.4],
  'closed-mid': [0.3, 0.75],
  'in-progress': [0.6, 1],
  'open-unlogged': null,
} as const satisfies Record<ArcSlot, readonly [number, number] | null>;

export function isIssueActive(issue: IssueFixture, arcPosition: number): boolean {
  const window = ARC_WINDOWS[issue.arc];
  if (window === null) return false;
  return arcPosition >= window[0] && arcPosition <= window[1];
}

function activeIssues(project: ProjectFixture, arcPosition: number): IssueFixture[] {
  const active = project.issues.filter((issue) => isIssueActive(issue, arcPosition));
  if (active.length > 0) return active;
  return project.issues.filter((issue) => issue.arc === 'in-progress');
}

interface Slot {
  date: string;
  durationSeconds: number;
  project: ProjectFixture | null;
  issue: IssueFixture | null;
  comment: string | null;
}

/** Deterministic seed material for a week: fixture-wide seed + tracker + week Monday. */
const FIXTURE_SEED = 'osi-dev-seed-v1';

/**
 * Generates every log for the run's calendar (design.md — D4). Weeks are
 * planned whole and seeded per `(tracker, week)`, so a given day yields the
 * same logs for every run in the same calendar week; the frame (and with it
 * each week's arc position) moves once a week, on Monday.
 *
 * Per tracker and full week the four routing patterns are guaranteed: the
 * focus issue's main note on the first two days (Task reuse), a second note
 * on it (sibling Task), one internal-project log (unmatched), and a blank
 * comment on the Friday log (`empty`).
 */
export function generateLogs(
  runDate: string,
  fixtures: readonly ClientFixture[] = CLIENT_FIXTURES,
): GeneratedLog[] {
  const calendar = buildCalendar(
    runDate,
    (weekMonday) => createRng(`${FIXTURE_SEED}:calendar:${weekMonday}`).next,
  );
  const logs: GeneratedLog[] = [];
  for (const fixture of fixtures) {
    logs.push(...generateForTracker(fixture, calendar));
  }
  const inRange = new Set(calendar.filter((day) => day.inRange).map((day) => day.date));
  return logs.filter((log) => inRange.has(log.spentOn));
}

function generateForTracker(fixture: ClientFixture, calendar: CalendarDay[]): GeneratedLog[] {
  const weeks = new Map<string, CalendarDay[]>();
  for (const day of calendar) {
    if (!day.trackers.some((entry) => entry.tracker === fixture.tracker)) continue;
    const bucket = weeks.get(day.weekMonday) ?? [];
    bucket.push(day);
    weeks.set(day.weekMonday, bucket);
  }

  const loggable = projectsWithIssues(fixture).filter((project) => !project.internal);
  const internal = projectsWithIssues(fixture).find((project) => project.internal) ?? null;
  const logs: GeneratedLog[] = [];

  for (const [weekMonday, days] of weeks) {
    const rng = createRng(`${FIXTURE_SEED}:${fixture.tracker}:${weekMonday}`);
    const slotsByDay = days.map((day) => {
      const entry = day.trackers.find((candidate) => candidate.tracker === fixture.tracker);
      if (!entry) throw new Error('calendar day without tracker entry');
      return splitMinutes(rng.next, entry.budgetMinutes, entry.logCount).map<Slot>((minutes) => ({
        date: day.date,
        durationSeconds: minutes * 60,
        project: null,
        issue: null,
        comment: null,
      }));
    });
    const arcPosition = days[0]?.arcPosition ?? 1;
    const focusProject = loggable[days[0] ? days[0].weeksBack % loggable.length : 0] ?? loggable[0];
    if (!focusProject) throw new Error('fixture has no loggable projects');
    const focusIssue = pickFocusIssue(rng, focusProject, arcPosition);

    const fullWeek =
      slotsByDay.length >= 3 &&
      (slotsByDay[0]?.length ?? 0) >= 2 &&
      (slotsByDay[1]?.length ?? 0) >= 2;
    if (fullWeek) {
      const [day0, day1] = slotsByDay;
      const lastDay = slotsByDay[slotsByDay.length - 1];
      const mainNote = focusIssue.comments[0] ?? focusIssue.subject;
      assign(day0?.[0], focusProject, focusIssue, mainNote);
      assign(day1?.[0], focusProject, focusIssue, mainNote);
      assign(day1?.[1], focusProject, focusIssue, focusIssue.comments[1] ?? `${mainNote} — review`);
      if (internal) {
        const internalIssue = rng.pick(activeIssues(internal, arcPosition));
        assign(
          day0?.[1],
          internal,
          internalIssue,
          internalIssue.comments[0] ?? internalIssue.subject,
        );
      }
      const blankProject = rng.pick(loggable);
      assign(
        lastDay?.[lastDay.length - 1],
        blankProject,
        rng.pick(activeIssues(blankProject, arcPosition)),
        null,
      );
    }

    for (const daySlots of slotsByDay) {
      for (const slot of daySlots) {
        if (slot.project !== null) continue;
        fillRandom(rng, slot, daySlots, loggable, focusProject, arcPosition);
      }
      for (const slot of daySlots) {
        if (!slot.project || !slot.issue) throw new Error('unfilled slot');
        logs.push({
          tracker: fixture.tracker,
          spentOn: slot.date,
          projectIdentifier: slot.project.identifier,
          issueSubject: slot.issue.subject,
          activityIndex: pickActivity(rng, fixture.activities.length),
          durationSeconds: slot.durationSeconds,
          comment: slot.comment,
        });
      }
    }
  }
  return logs;
}

function pickFocusIssue(rng: Rng, project: ProjectFixture, arcPosition: number): IssueFixture {
  const active = activeIssues(project, arcPosition);
  const withTwoNotes = active.filter((issue) => issue.comments.length >= 2);
  return rng.pick(withTwoNotes.length > 0 ? withTwoNotes : active);
}

function assign(
  slot: Slot | undefined,
  project: ProjectFixture,
  issue: IssueFixture,
  comment: string | null,
): void {
  if (!slot) return;
  slot.project = project;
  slot.issue = issue;
  slot.comment = comment;
}

/** Same issue + comment twice on one day would collapse into one idempotency key. */
function collides(slot: Slot, daySlots: Slot[]): boolean {
  return daySlots.some(
    (other) =>
      other !== slot &&
      other.project?.identifier === slot.project?.identifier &&
      other.issue?.subject === slot.issue?.subject &&
      other.comment === slot.comment,
  );
}

function fillRandom(
  rng: Rng,
  slot: Slot,
  daySlots: Slot[],
  loggable: ProjectFixture[],
  focusProject: ProjectFixture,
  arcPosition: number,
): void {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const project = rng.next() < 0.5 ? focusProject : rng.pick(loggable);
    const issue = rng.pick(activeIssues(project, arcPosition));
    const comment = issue.comments.length > 0 ? rng.pick(issue.comments) : issue.subject;
    assign(slot, project, issue, comment);
    if (!collides(slot, daySlots)) return;
  }
  // Fall back to a comment that is unique by construction for this day.
  slot.comment = `${slot.comment ?? slot.issue?.subject ?? 'work'} (${daySlots.indexOf(slot) + 1})`;
}

/** Mostly the first activity (e.g. Development) with an occasional other one. */
function pickActivity(rng: Rng, count: number): number {
  if (count <= 1 || rng.next() < 0.7) return 0;
  return rng.int(1, count - 1);
}
