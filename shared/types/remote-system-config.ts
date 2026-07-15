import { z } from 'zod';

export const remoteSystemTypeSchema = z.enum(['redmine', 'openproject'], {
  required_error: 'error.remoteConfigSystemTypeRequired',
  invalid_type_error: 'error.remoteConfigSystemTypeRequired',
});

export type RemoteSystemType = z.infer<typeof remoteSystemTypeSchema>;

export const remoteExecutionModeSchema = z.enum(['client'], {
  required_error: 'error.remoteConfigExecutionModeRequired',
  invalid_type_error: 'error.remoteConfigExecutionModeRequired',
});

export type RemoteExecutionMode = z.infer<typeof remoteExecutionModeSchema>;

export const remoteRoundingRuleSchema = z.enum(['none', 'up_15m', 'up_30m', 'up_1h'], {
  required_error: 'error.remoteConfigRoundingRuleRequired',
  invalid_type_error: 'error.remoteConfigRoundingRuleRequired',
});

export type RemoteRoundingRule = z.infer<typeof remoteRoundingRuleSchema>;

/**
 * Selects the search transport: `direct` (default) keeps the existing
 * browser-to-tracker request; `proxied` routes the search through the OSI
 * server, which forwards it to the tracker (no CORS involved).
 */
export const remoteTransportModeSchema = z.enum(['direct', 'proxied'], {
  required_error: 'error.remoteConfigTransportModeRequired',
  invalid_type_error: 'error.remoteConfigTransportModeRequired',
});

export type RemoteTransportMode = z.infer<typeof remoteTransportModeSchema>;

export const createRemoteSystemConfigSchema = z.object({
  systemType: remoteSystemTypeSchema,
  baseUrl: z
    .string({
      required_error: 'error.remoteConfigBaseUrlRequired',
      invalid_type_error: 'error.remoteConfigBaseUrlRequired',
    })
    .trim()
    .url({ message: 'error.remoteConfigBaseUrlInvalid' }),
  executionMode: remoteExecutionModeSchema,
  transportMode: remoteTransportModeSchema.default('direct'),
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
  transportMode: RemoteTransportMode;
  roundingRule: RemoteRoundingRule;
  requiredFieldDefaults: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}
