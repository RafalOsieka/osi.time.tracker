import { z } from 'zod';

export const trackerSystemTypeSchema = z.enum(['redmine', 'openproject'], {
  error: 'error.trackerSystemTypeRequired',
});

export type TrackerSystemType = z.infer<typeof trackerSystemTypeSchema>;

/** Stable display order for system-type selects (product names, not i18n keys). */
export const TRACKER_SYSTEM_TYPE_ORDER = [
  'openproject',
  'redmine',
] as const satisfies readonly TrackerSystemType[];

/** Display labels for each system type (proper nouns; not catalog strings). */
export const TRACKER_SYSTEM_TYPE_LABELS = {
  openproject: 'OpenProject',
  redmine: 'Redmine',
} as const satisfies Record<TrackerSystemType, string>;
