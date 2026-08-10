import { z } from 'zod';

export const trackerSystemTypeSchema = z.enum(['redmine', 'openproject'], {
  error: 'error.trackerSystemTypeRequired',
});

export type TrackerSystemType = z.infer<typeof trackerSystemTypeSchema>;

/**
 * Selects the execution mode: `client` (default) sends remote requests
 * directly from the browser to the tracker; `server` routes them through
 * the OSI server, which forwards them to the tracker (no CORS involved).
 */
export const trackerExecutionModeSchema = z.enum(['client', 'server'], {
  error: 'error.trackerExecutionModeRequired',
});

export type TrackerExecutionMode = z.infer<typeof trackerExecutionModeSchema>;

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
export const TRACKER_ROUNDING_RULE_ORDER: readonly TrackerRoundingRule[] = [
  'none',
  'up_15m',
  'up_30m',
  'up_1h',
  'nearest_15m',
  'nearest_30m',
  'nearest_1h',
] as const;

export const TRACKER_NAME_MAX_LENGTH = 100;

export const createTrackerSchema = z.object({
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
  executionMode: trackerExecutionModeSchema.default('client'),
  roundingRule: trackerRoundingRuleSchema,
  requiredFieldDefaults: z.record(z.string(), z.string()).optional(),
});

export type CreateTrackerDto = z.infer<typeof createTrackerSchema>;

export const updateTrackerSchema = createTrackerSchema;

export type UpdateTrackerDto = z.infer<typeof updateTrackerSchema>;

export interface TrackerDto {
  id: string;
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  executionMode: TrackerExecutionMode;
  roundingRule: TrackerRoundingRule;
  requiredFieldDefaults: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
