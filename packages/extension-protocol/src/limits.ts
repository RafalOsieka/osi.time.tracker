/** Shared safety bounds for extension messaging and worker network use. */
export const EXTENSION_RESOURCE_LIMITS = {
  maxRequestEnvelopeBytes: 1 * 1024 * 1024,
  maxResponseEnvelopeBytes: 10 * 1024 * 1024,
  maxInFlightOperationsPerDocument: 4,
  maxNetworkCallsPerOperation: 100,
  networkRequestTimeoutMs: 20_000,
  operationTimeoutMs: 120_000,
  pageDeadlineMs: 130_000,
} as const;

export type ExtensionResourceLimits = typeof EXTENSION_RESOURCE_LIMITS;
