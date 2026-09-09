import { z } from 'zod';
import { trackerSystemTypeSchema, type TrackerSystemType } from '@osi/remote-trackers/contracts';

/**
 * Whether the tracker origin allows direct browser requests. `true` (default)
 * uses the client adapter; `false` requires the desktop extension. The
 * obsolete `executionMode` field is rejected so stale clients fail closed.
 */
export const trackerDirectBrowserAccessSchema = z.boolean({
  error: 'error.trackerDirectBrowserAccessInvalid',
});

/**
 * Tracker-level export rounding rule. `none` passes the total through;
 * `up_*` always rounds up to the next increment; `nearest_*` rounds to the
 * closest increment (half-up at the midpoint). Stored as plain text —
 * widening the enum needs no migration.
 */
export const trackerRoundingRuleSchema = z.enum(
  ['none', 'up_15m', 'up_30m', 'up_1h', 'nearest_15m', 'nearest_30m', 'nearest_1h'],
  {
    error: 'error.trackerRoundingRuleRequired',
  },
);

export type TrackerRoundingRule = z.infer<typeof trackerRoundingRuleSchema>;

/** Stable display order for configuration selects: passthrough → up → nearest. */
export const TRACKER_ROUNDING_RULE_ORDER = [
  'none',
  'up_15m',
  'up_30m',
  'up_1h',
  'nearest_15m',
  'nearest_30m',
  'nearest_1h',
] as const satisfies readonly TrackerRoundingRule[];

export const TRACKER_NAME_MAX_LENGTH = 100;

export const trackerWriteFieldsSchema = z.object({
  name: z
    .string({ error: 'error.trackerNameRequired' })
    .trim()
    .min(1, { error: 'error.trackerNameRequired' })
    .max(TRACKER_NAME_MAX_LENGTH, { error: 'error.trackerNameTooLong' }),
  systemType: trackerSystemTypeSchema,
  baseUrl: z
    .url({
      error: (issue) =>
        issue.input === undefined ? 'error.trackerBaseUrlRequired' : 'error.trackerBaseUrlInvalid',
    })
    .trim(),
  directBrowserAccess: trackerDirectBrowserAccessSchema.default(true),
  roundingRule: trackerRoundingRuleSchema,
});

export const createTrackerSchema = trackerWriteFieldsSchema
  .extend({
    executionMode: z.never({ error: 'error.trackerExecutionModeRequired' }).optional(),
  })
  .transform(({ executionMode: _obsolete, ...rest }) => rest);

export type CreateTrackerDto = z.infer<typeof createTrackerSchema>;

export const updateTrackerSchema = createTrackerSchema;

export type UpdateTrackerDto = z.infer<typeof updateTrackerSchema>;

export interface TrackerDto {
  id: string;
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  directBrowserAccess: boolean;
  roundingRule: TrackerRoundingRule;
  createdAt: string;
  updatedAt: string;
}
