import type {
  DashboardGroupDto,
  DashboardGrouping,
  DashboardGroupIdentityDto,
  DashboardPeriodDto,
} from '../../shared/types/dashboard';
import type { MonthlyReportDayDto } from '../../shared/types/report';
import { bucketOf } from './dashboard-period';
import { aggregateLocalDaySeconds, type StoppedEntryInstants } from './monthly-report';

interface NamedRow {
  id: string;
  name: string;
  deletedAt: Date | null;
}

interface ProjectAndTracker {
  project: NamedRow | null;
  /** The Project's Tracker; none without a Project or for a Local project. */
  tracker: NamedRow | null;
}

/** The days of one Project, or of no Project. */
export interface ProjectDays extends ProjectAndTracker {
  days: MonthlyReportDayDto[];
}

/** Both groupings and the summary are sums over these, so entries are put on days once. */
export function aggregateProjectDays(
  entries: readonly (StoppedEntryInstants & ProjectAndTracker)[],
  timeZone: string,
): ProjectDays[] {
  const byProject = Map.groupBy(entries, (entry) => entry.project?.id);
  return [...byProject.values()].map((projectEntries) => ({
    project: projectEntries[0]?.project ?? null,
    tracker: projectEntries[0]?.tracker ?? null,
    days: aggregateLocalDaySeconds(projectEntries, timeZone),
  }));
}

function identify(
  { project, tracker }: ProjectAndTracker,
  grouping: DashboardGrouping,
): DashboardGroupIdentityDto {
  if (!project) return { kind: 'noProject' };
  const row = grouping === 'project' ? project : tracker;
  if (!row) return { kind: 'local' };
  return { kind: grouping, id: row.id, name: row.name, deleted: row.deletedAt !== null };
}

/** Groups with time, largest first, equal ones in creation order with the unnamed ones last. */
export function groupProjectDays(
  projectDays: readonly ProjectDays[],
  grouping: DashboardGrouping,
  period: DashboardPeriodDto,
  buckets: readonly string[],
): DashboardGroupDto[] {
  const secondsByGroup = new Map<
    string,
    { identity: DashboardGroupIdentityDto; byBucket: Map<string, number> }
  >();
  for (const project of projectDays) {
    const identity = identify(project, grouping);
    // Ids are time-ordered and sort before the words, which gives equal groups their order.
    const key = 'id' in identity ? identity.id : identity.kind;
    const group = secondsByGroup.get(key) ?? { identity, byBucket: new Map<string, number>() };
    secondsByGroup.set(key, group);
    for (const { date, localSeconds } of project.days) {
      const bucket = bucketOf(date, period);
      group.byBucket.set(bucket, (group.byBucket.get(bucket) ?? 0) + localSeconds);
    }
  }

  return [...secondsByGroup.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, { identity, byBucket }]) => ({
      ...identity,
      totalSeconds: [...byBucket.values()].reduce((sum, seconds) => sum + seconds, 0),
      bucketSeconds: buckets.map((bucket) => byBucket.get(bucket) ?? 0),
    }))
    .filter((group) => group.totalSeconds > 0)
    .sort((left, right) => right.totalSeconds - left.totalSeconds);
}
