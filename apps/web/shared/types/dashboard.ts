import { z } from 'zod';

/** The first and last day whose period surely stays within four-digit years in any timezone. */
const DASHBOARD_DATE_MIN = '0002-01-01';
const DASHBOARD_DATE_MAX = '9998-12-31';

export const dashboardPeriodKindSchema = z.enum(['week', 'month', 'year'], {
  error: 'error.dashboardPeriodInvalid',
});

export type DashboardPeriodKind = z.infer<typeof dashboardPeriodKindSchema>;

/** Any local day of the wanted period. */
export const dashboardDateSchema = z.iso
  .date({ error: 'error.dashboardDateInvalid' })
  .refine((date) => date >= DASHBOARD_DATE_MIN && date <= DASHBOARD_DATE_MAX, {
    error: 'error.dashboardDateInvalid',
  });

export const dashboardQuerySchema = z.object({
  period: dashboardPeriodKindSchema.optional(),
  date: dashboardDateSchema.optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface DashboardPeriodDto {
  kind: DashboardPeriodKind;
  firstDay: string;
  /** Inclusive. */
  lastDay: string;
}

/** Completed Time entries of the period, each counted wholly on the local day of its start. */
export interface DashboardSummaryDto {
  totalSeconds: number;
  daysWithEntries: number;
  /** Per day with entries; 0 without any. */
  averageSeconds: number;
}

export const DASHBOARD_GROUPINGS = ['project', 'tracker'] as const;

export type DashboardGrouping = (typeof DASHBOARD_GROUPINGS)[number];

/** What a group stands for: `local` is the Local projects, `noProject` the time in no Project. */
export type DashboardGroupIdentityDto =
  | { kind: 'project' | 'tracker'; id: string; name: string; deleted: boolean }
  | { kind: 'local' }
  | { kind: 'noProject' };

/** Tells groups apart, in either grouping. */
export function dashboardGroupKey(group: DashboardGroupIdentityDto): string {
  return 'id' in group ? group.id : group.kind;
}

/** The chart colors this many groups of a period and folds the rest into "Other". */
export const DASHBOARD_COLOR_SLOTS = 6;

export type DashboardGroupDto = DashboardGroupIdentityDto & {
  totalSeconds: number;
  /** One value per bucket of the period, in the same order. */
  bucketSeconds: number[];
  /**
   * Palette slot, from 0, of one of the largest named groups; none for the rest and for "No
   * project". It follows creation order, not the ranking, so a group keeps its color between
   * periods unless another group of the period wants the same slot.
   */
  colorSlot: number | null;
};

/** How many Tasks the Dashboard lists. */
export const DASHBOARD_TOP_TASKS = 10;

/** One Task identity (ADR-0004) with its time in the period, counted like the summary. */
export interface DashboardTaskDto {
  id: string;
  name: string;
  project: { id: string; name: string; deleted: boolean } | null;
  remoteIssue: {
    id: string;
    title: string;
    /** None while the issue's Tracker is deleted or of a kind the app cannot link to. */
    url: string | null;
  } | null;
  totalSeconds: number;
}

export interface DashboardDto {
  period: DashboardPeriodDto;
  today: string;
  timezone: string;
  /** ISO weekday, 1 (Monday) to 7 (Sunday). */
  firstDayOfWeek: number;
  /** Whether the account has any Time entry at all, in this period or not. */
  hasEntries: boolean;
  summary: DashboardSummaryDto;
  /** Every day of a week or month, the first day of every month of a year. */
  buckets: string[];
  /** Groups with time in the period, largest first; either list adds up to the summary's total. */
  groups: Record<DashboardGrouping, DashboardGroupDto[]>;
  /** The Tasks with the most time, most first, equal ones in creation order. */
  topTasks: DashboardTaskDto[];
}
