import type { JsonValue } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import { EXTENSION_ERROR_MESSAGE_KEYS, safeWireErrorSchema, type SafeWireError } from './errors.js';
import { handshakeRequestSchema, handshakeResultSchema } from './handshake.js';
import { EXTENSION_RESOURCE_LIMITS } from './limits.js';
import {
  operationNameSchema,
  operationRequestSchema,
  operationSuccessSchema,
  requestIdSchema,
  type ExtensionOperationName,
  type OperationRequest,
  type OperationSuccess,
} from './operations.js';
import { EXTENSION_PROTOCOL_VERSION } from './version.js';

export type EnvelopeParseSuccess<T> = {
  readonly success: true;
  readonly data: T;
};

export type EnvelopeParseFailure = {
  readonly success: false;
  readonly error: SafeWireError;
};

export type EnvelopeParseResult<T> = EnvelopeParseSuccess<T> | EnvelopeParseFailure;

export const operationFailureSchema = z.object({
  type: z.literal('operation-result'),
  requestId: requestIdSchema,
  operation: operationNameSchema,
  ok: z.literal(false),
  error: safeWireErrorSchema,
});

export type OperationFailure = z.infer<typeof operationFailureSchema>;

export type OperationResult = OperationSuccess | OperationFailure;

function limitError(): SafeWireError {
  return { kind: 'limit', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit };
}

function malformedError(): SafeWireError {
  return { kind: 'malformed', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed };
}

function incompatibleError(): SafeWireError {
  return { kind: 'incompatible', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible };
}

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** JSON byte length of a cloned protocol envelope. */
export function measureEnvelopeBytes(value: JsonValue): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function rejectIfOversized(value: JsonValue, maxBytes: number): EnvelopeParseFailure | undefined {
  if (measureEnvelopeBytes(value) > maxBytes) {
    return { success: false, error: limitError() };
  }
  return undefined;
}

function rejectIfIncompatibleVersion(value: JsonValue): EnvelopeParseFailure | undefined {
  if (!isJsonObject(value)) return undefined;
  const version = value.protocolVersion;
  if (typeof version === 'number' && version !== EXTENSION_PROTOCOL_VERSION) {
    return { success: false, error: incompatibleError() };
  }
  return undefined;
}

function parseWithSchema<T>(
  value: JsonValue,
  schema: z.ZodType<T>,
  maxBytes: number,
): EnvelopeParseResult<T> {
  const oversized = rejectIfOversized(value, maxBytes);
  if (oversized) return oversized;
  const incompatible = rejectIfIncompatibleVersion(value);
  if (incompatible) return incompatible;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { success: false, error: malformedError() };
  }
  return { success: true, data: parsed.data };
}

/** Validates a credential-free handshake request. */
export function parseHandshakeRequest(
  value: JsonValue,
): EnvelopeParseResult<z.infer<typeof handshakeRequestSchema>> {
  return parseWithSchema(
    value,
    handshakeRequestSchema,
    EXTENSION_RESOURCE_LIMITS.maxRequestEnvelopeBytes,
  );
}

/** Validates a credential-free handshake result. */
export function parseHandshakeResult(
  value: JsonValue,
): EnvelopeParseResult<z.infer<typeof handshakeResultSchema>> {
  return parseWithSchema(
    value,
    handshakeResultSchema,
    EXTENSION_RESOURCE_LIMITS.maxResponseEnvelopeBytes,
  );
}

/** Validates an operation request, including size and schema bounds. */
export function parseOperationRequest(value: JsonValue): EnvelopeParseResult<OperationRequest> {
  return parseWithSchema(
    value,
    operationRequestSchema,
    EXTENSION_RESOURCE_LIMITS.maxRequestEnvelopeBytes,
  );
}

function parseOperationFailure(value: JsonValue): EnvelopeParseResult<OperationFailure> {
  return parseWithSchema(
    value,
    operationFailureSchema,
    EXTENSION_RESOURCE_LIMITS.maxResponseEnvelopeBytes,
  );
}

function parseOperationSuccess(value: JsonValue): EnvelopeParseResult<OperationSuccess> {
  return parseWithSchema(
    value,
    operationSuccessSchema,
    EXTENSION_RESOURCE_LIMITS.maxResponseEnvelopeBytes,
  );
}

/**
 * Validates an operation result and requires its discriminant to match the
 * in-flight request operation.
 */
export function parseMatchedOperationResult(
  expectedOperation: ExtensionOperationName,
  value: JsonValue,
): EnvelopeParseResult<OperationResult> {
  const oversized = rejectIfOversized(value, EXTENSION_RESOURCE_LIMITS.maxResponseEnvelopeBytes);
  if (oversized) return oversized;

  if (!isJsonObject(value) || value.ok !== true) {
    const failure = parseOperationFailure(value);
    if (!failure.success) return failure;
    if (failure.data.operation !== expectedOperation) {
      return { success: false, error: malformedError() };
    }
    return failure;
  }

  const success = parseOperationSuccess(value);
  if (!success.success) return success;
  if (success.data.operation !== expectedOperation) {
    return { success: false, error: malformedError() };
  }
  return success;
}
