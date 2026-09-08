import { RemoteAdapterError } from '@osi/remote-trackers/contracts';
import { z } from 'zod';

export const extensionErrorKindSchema = z.enum([
  'adapter',
  'unavailable',
  'incompatible',
  'permission',
  'unknown-create',
  'malformed',
  'timeout',
  'limit',
]);

export type ExtensionErrorKind = z.infer<typeof extensionErrorKindSchema>;

export const EXTENSION_ERROR_MESSAGE_KEYS = {
  unavailable: 'error.extensionUnavailable',
  incompatible: 'error.extensionIncompatible',
  permission: 'error.extensionPermissionRequired',
  unknownCreate: 'error.extensionUnknownCreate',
  malformed: 'error.extensionMalformed',
  timeout: 'error.extensionTimeout',
  limit: 'error.extensionLimitExceeded',
  destinationUnapproved: 'error.extensionDestinationUnapproved',
  originUnapproved: 'error.extensionOriginUnapproved',
} as const;

export const safeWireErrorSchema = z.object({
  kind: extensionErrorKindSchema,
  messageKey: z.string().min(1).max(200),
  status: z.number().int().optional(),
});

export type SafeWireError = z.infer<typeof safeWireErrorSchema>;

/** Extension-owned failure distinct from a reconstructed `RemoteAdapterError`. */
export class ExtensionProtocolError extends Error {
  readonly kind: Exclude<ExtensionErrorKind, 'adapter'>;
  readonly messageKey: string;
  readonly status?: number;

  constructor(kind: Exclude<ExtensionErrorKind, 'adapter'>, messageKey: string, status?: number) {
    super(messageKey);
    this.name = 'ExtensionProtocolError';
    this.kind = kind;
    this.messageKey = messageKey;
    this.status = status;
  }
}

/** Maps a provider error onto the allowlisted wire fields only. */
export function serializeAdapterError(error: RemoteAdapterError): SafeWireError {
  if (error.status === undefined) {
    return { kind: 'adapter', messageKey: error.messageKey };
  }
  return { kind: 'adapter', messageKey: error.messageKey, status: error.status };
}

/** Maps an extension-owned error onto the allowlisted wire fields only. */
export function serializeProtocolError(error: ExtensionProtocolError): SafeWireError {
  if (error.status === undefined) {
    return { kind: error.kind, messageKey: error.messageKey };
  }
  return { kind: error.kind, messageKey: error.messageKey, status: error.status };
}

/**
 * Rebuilds a `RemoteAdapterError` from validated wire fields, preserving the
 * provider `messageKey` and optional HTTP `status`.
 */
export function reconstructAdapterError(error: SafeWireError): RemoteAdapterError {
  return new RemoteAdapterError(error.messageKey, error.status);
}

/** Rebuilds the corresponding error class from a validated wire error. */
export function reconstructProtocolError(
  error: SafeWireError,
): RemoteAdapterError | ExtensionProtocolError {
  if (error.kind === 'adapter') {
    return reconstructAdapterError(error);
  }
  return new ExtensionProtocolError(error.kind, error.messageKey, error.status);
}

export function isUnknownCreateError(error: ExtensionProtocolError): boolean {
  return error.kind === 'unknown-create';
}
