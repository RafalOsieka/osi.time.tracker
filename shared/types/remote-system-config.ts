import { z } from 'zod';

export const remoteSystemTypeSchema = z.enum(['redmine', 'openproject'], {
  error: 'error.remoteConfigSystemTypeRequired',
});

export type RemoteSystemType = z.infer<typeof remoteSystemTypeSchema>;

/**
 * Selects the execution mode: `client` (default) sends remote requests
 * directly from the browser to the tracker; `server` routes them through
 * the OSI server, which forwards them to the tracker (no CORS involved).
 */
export const remoteExecutionModeSchema = z.enum(['client', 'server'], {
  error: 'error.remoteConfigExecutionModeRequired',
});

export type RemoteExecutionMode = z.infer<typeof remoteExecutionModeSchema>;

/**
 * Client-level export rounding rule. `none` passes the total through;
 * `up_*` always rounds up to the next increment; `nearest_*` rounds to the
 * closest increment (half-up at the midpoint). Stored as plain text —
 * widening the enum needs no migration.
 */
export const remoteRoundingRuleSchema = z.enum(
  ['none', 'up_15m', 'up_30m', 'up_1h', 'nearest_15m', 'nearest_30m', 'nearest_1h'],
  {
    error: 'error.remoteConfigRoundingRuleRequired',
  },
);

export type RemoteRoundingRule = z.infer<typeof remoteRoundingRuleSchema>;

/** Stable display order for configuration selects: passthrough → up → nearest. */
export const REMOTE_ROUNDING_RULE_ORDER: readonly RemoteRoundingRule[] = [
  'none',
  'up_15m',
  'up_30m',
  'up_1h',
  'nearest_15m',
  'nearest_30m',
  'nearest_1h',
] as const;

export const createRemoteSystemConfigSchema = z.object({
  systemType: remoteSystemTypeSchema,
  baseUrl: z
    .url({
      error: (issue) =>
        issue.input === undefined
          ? 'error.remoteConfigBaseUrlRequired'
          : 'error.remoteConfigBaseUrlInvalid',
    })
    .trim(),
  executionMode: remoteExecutionModeSchema.default('client'),
  roundingRule: remoteRoundingRuleSchema,
  requiredFieldDefaults: z.record(z.string(), z.string()).optional(),
});

export type CreateRemoteSystemConfigDto = z.infer<typeof createRemoteSystemConfigSchema>;

export const updateRemoteSystemConfigSchema = createRemoteSystemConfigSchema;

export type UpdateRemoteSystemConfigDto = z.infer<typeof updateRemoteSystemConfigSchema>;

export interface RemoteSystemConfigDto {
  id: string;
  clientId: string;
  systemType: RemoteSystemType;
  baseUrl: string;
  executionMode: RemoteExecutionMode;
  roundingRule: RemoteRoundingRule;
  requiredFieldDefaults: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
