import {
  DASHBOARD_COLOR_SLOTS,
  dashboardGroupKey,
  type DashboardGroupDto,
  type DashboardGrouping,
  type DashboardGroupIdentityDto,
  type DashboardPeriodDto,
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

/**
 * Palette slots for groups at the given places in creation order, at most
 * `DASHBOARD_COLOR_SLOTS` of them. Each group wants the slot of its place; of two that want one
 * slot the earlier keeps it, and the later takes the next slot nobody wants or holds.
 */
export function assignColorSlots(places: readonly number[]): number[] {
  if (places.length > DASHBOARD_COLOR_SLOTS) throw new RangeError('More groups than slots');
  const byPlace = places
    .map((place, index) => ({ index, wanted: place % DASHBOARD_COLOR_SLOTS, place }))
    .sort((left, right) => left.place - right.place);
  const slots: number[] = [];
  const taken = new Set<number>();
  const moved: typeof byPlace = [];
  for (const group of byPlace) {
    if (taken.has(group.wanted)) {
      moved.push(group);
      continue;
    }
    taken.add(group.wanted);
    slots[group.index] = group.wanted;
  }
  for (const group of moved) {
    let slot = group.wanted;
    while (taken.has(slot)) slot = (slot + 1) % DASHBOARD_COLOR_SLOTS;
    taken.add(slot);
    slots[group.index] = slot;
  }
  return slots;
}

/**
 * Groups with time, largest first, equal ones in creation order with the unnamed ones last. The
 * largest named groups get a color slot. `creationOrder` holds the ids of every Project or every
 * Tracker of the user, deleted ones included, oldest first; "Local" comes after them.
 */
export function groupProjectDays(
  projectDays: readonly ProjectDays[],
  grouping: DashboardGrouping,
  period: DashboardPeriodDto,
  buckets: readonly string[],
  creationOrder: readonly string[],
): DashboardGroupDto[] {
  const secondsByGroup = new Map<
    string,
    { identity: DashboardGroupIdentityDto; byBucket: Map<string, number> }
  >();
  for (const project of projectDays) {
    const identity = identify(project, grouping);
    // Ids are time-ordered and sort before the words, which gives equal groups their order.
    const key = dashboardGroupKey(identity);
    const group = secondsByGroup.get(key) ?? { identity, byBucket: new Map<string, number>() };
    secondsByGroup.set(key, group);
    for (const { date, localSeconds } of project.days) {
      const bucket = bucketOf(date, period);
      group.byBucket.set(bucket, (group.byBucket.get(bucket) ?? 0) + localSeconds);
    }
  }

  const groups = [...secondsByGroup.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, { identity, byBucket }]) => ({
      ...identity,
      totalSeconds: [...byBucket.values()].reduce((sum, seconds) => sum + seconds, 0),
      bucketSeconds: buckets.map((bucket) => byBucket.get(bucket) ?? 0),
    }))
    .filter((group) => group.totalSeconds > 0)
    .sort((left, right) => right.totalSeconds - left.totalSeconds);

  const places = new Map(creationOrder.map((id, place) => [id, place]));
  const colored = groups
    .filter((group) => group.kind !== 'noProject')
    .slice(0, DASHBOARD_COLOR_SLOTS);
  const slots = assignColorSlots(
    colored.map((group) =>
      'id' in group ? (places.get(group.id) ?? creationOrder.length) : creationOrder.length,
    ),
  );
  const slotByKey = new Map(
    colored.map((group, index) => [dashboardGroupKey(group), slots[index]]),
  );
  return groups.map((group) => ({
    ...group,
    colorSlot: slotByKey.get(dashboardGroupKey(group)) ?? null,
  }));
}
