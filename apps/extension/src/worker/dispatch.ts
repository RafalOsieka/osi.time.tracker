import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  parseHandshakeRequest,
  parseOperationRequest,
  parseMatchedOperationResult,
  reconstructProtocolError,
  serializeAdapterError,
  serializeProtocolError,
  type HandshakeResult,
  type OperationFailure,
  type OperationRequest,
  type OperationResult,
  type SafeWireError,
} from '@osi/extension-protocol';
import {
  RemoteAdapterError,
  type JsonValue,
  type RemoteTrackerAdapter,
  type TrackerSystemType,
  type Transport,
} from '@osi/remote-trackers/contracts';
import type { ApprovalService, DestinationApproval } from '../approvals/approvals.js';
import { CanonicalizationError } from '../security/canonicalize.js';
import { createProviderAdapter } from '../providers.js';
import { createGuardedTransport } from '../transport/guarded-transport.js';
import { documentKey, isTrustedDocumentSender, type RuntimeSender } from './sender.js';

export type CreateProviderAdapter = (
  provider: TrackerSystemType,
  transport: Transport,
  baseUrl: string,
  secret: string,
) => RemoteTrackerAdapter;

const inFlightByDocument = new Map<string, number>();

const permissionError: SafeWireError = {
  kind: 'permission',
  messageKey: EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved,
};

function toWireError(
  error: RemoteAdapterError | ExtensionProtocolError | CanonicalizationError,
): SafeWireError {
  if (error instanceof RemoteAdapterError) return serializeAdapterError(error);
  if (error instanceof ExtensionProtocolError) return serializeProtocolError(error);
  if (error.messageKey === 'error.extensionPermissionRequired') {
    return { kind: 'permission', messageKey: error.messageKey };
  }
  if (error.messageKey === 'error.extensionOriginUnapproved') {
    return { kind: 'permission', messageKey: error.messageKey };
  }
  return { kind: 'permission', messageKey: 'error.extensionDestinationUnapproved' };
}

function failure(request: OperationRequest, error: SafeWireError): OperationFailure {
  return {
    type: 'operation-result',
    requestId: request.requestId,
    operation: request.operation,
    ok: false,
    error,
  };
}

async function executeOperation(
  adapter: RemoteTrackerAdapter,
  request: OperationRequest,
): Promise<OperationResult> {
  switch (request.operation) {
    case 'searchIssues': {
      const result = await adapter.searchIssues(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'searchIssues',
        ok: true,
        result,
      };
    }
    case 'getIssueById': {
      const result = await adapter.getIssueById(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getIssueById',
        ok: true,
        result,
      };
    }
    case 'getActivityOptions': {
      const result = await adapter.getActivityOptions(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getActivityOptions',
        ok: true,
        result,
      };
    }
    case 'getCurrentAccount': {
      const result = await adapter.getCurrentAccount();
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getCurrentAccount',
        ok: true,
        result,
      };
    }
    case 'fetchTimeLogs': {
      const result = await adapter.fetchTimeLogs(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'fetchTimeLogs',
        ok: true,
        result,
      };
    }
    case 'fetchTimeLogsInRange': {
      const result = await adapter.fetchTimeLogsInRange(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'fetchTimeLogsInRange',
        ok: true,
        result,
      };
    }
    case 'createTimeEntry': {
      const result = await adapter.createTimeEntry(request.input);
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'createTimeEntry',
        ok: true,
        result,
      };
    }
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

async function approvedOrigins(approvals: ApprovalService): Promise<string[]> {
  const listed = await approvals.list();
  return listed.websites.map((item) => item.origin);
}

export async function handleHandshake(options: {
  sender: RuntimeSender;
  expectedExtensionId: string;
  value: JsonValue;
  approvals: ApprovalService;
  onAuthorized?: (approval: DestinationApproval) => void;
}): Promise<HandshakeResult | SafeWireError> {
  const parsed = parseHandshakeRequest(options.value);
  if (!parsed.success) return parsed.error;
  const origins = await approvedOrigins(options.approvals);
  if (!isTrustedDocumentSender(options.sender, options.expectedExtensionId, origins)) {
    return permissionError;
  }
  const senderOrigin = options.sender.origin;
  if (!senderOrigin) return permissionError;
  let destinationApproved: boolean | undefined;
  if (parsed.data.destination) {
    try {
      const approval = await options.approvals.authorizedDestination(
        senderOrigin,
        parsed.data.destination.provider,
        parsed.data.destination.baseUrl,
      );
      options.onAuthorized?.(approval);
      destinationApproved = true;
    } catch {
      destinationApproved = false;
    }
  }
  return {
    type: 'handshake-result',
    protocolVersion: parsed.data.protocolVersion,
    supportedOperations: [...EXTENSION_OPERATION_NAMES],
    destinationApproved,
  };
}

export async function handleOperation(options: {
  sender: RuntimeSender;
  expectedExtensionId: string;
  value: JsonValue;
  approvals: ApprovalService;
  onAuthorized?: (approval: DestinationApproval) => void;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  createAdapter?: CreateProviderAdapter;
  operationTimeoutMs?: number;
}): Promise<OperationResult | SafeWireError> {
  const parsed = parseOperationRequest(options.value);
  if (!parsed.success) return parsed.error;
  const request = parsed.data;
  const origins = await approvedOrigins(options.approvals);
  if (!isTrustedDocumentSender(options.sender, options.expectedExtensionId, origins)) {
    return failure(request, permissionError);
  }
  const senderOrigin = options.sender.origin;
  if (!senderOrigin) return failure(request, permissionError);

  const key = documentKey(options.sender);
  const current = inFlightByDocument.get(key) ?? 0;
  if (current >= EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument) {
    return failure(request, {
      kind: 'limit',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit,
    });
  }
  inFlightByDocument.set(key, current + 1);
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(
    options.operationTimeoutMs ?? EXTENSION_RESOURCE_LIMITS.operationTimeoutMs,
  );
  const combined = AbortSignal.any(
    options.signal ? [options.signal, controller.signal, timeout] : [controller.signal, timeout],
  );
  let unregister = () => {};
  let writeDispatched = false;
  try {
    const approval = await options.approvals.authorizedDestination(
      senderOrigin,
      request.provider,
      request.baseUrl,
    );
    options.onAuthorized?.(approval);
    unregister = options.approvals.registerInFlight(approval, {
      abort: () => controller.abort(),
    });
    const transport = createGuardedTransport({
      approval,
      approvals: options.approvals,
      fetchImpl: options.fetchImpl,
      signal: combined,
      onWriteOutcome: (outcome) => {
        writeDispatched = outcome === 'dispatched';
      },
    });
    const adapter = (options.createAdapter ?? createProviderAdapter)(
      request.provider,
      transport,
      request.baseUrl,
      request.secret,
    );
    const result = await executeOperation(adapter, request);
    const validated = parseMatchedOperationResult(request.operation, result);
    if (!validated.success) {
      throw reconstructProtocolError(validated.error);
    }
    return validated.data;
  } catch (error) {
    // Provider error mapping loses transport details. Retain dispatch state outside
    // the adapter until a validated success or definite rejection is available.
    if (request.operation === 'createTimeEntry' && writeDispatched) {
      return failure(request, {
        kind: 'unknown-create',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate,
      });
    }
    if (
      error instanceof RemoteAdapterError ||
      error instanceof ExtensionProtocolError ||
      error instanceof CanonicalizationError
    ) {
      return failure(request, toWireError(error));
    }
    return failure(request, {
      kind: 'malformed',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed,
    });
  } finally {
    unregister();
    const remaining = (inFlightByDocument.get(key) ?? 1) - 1;
    if (remaining <= 0) inFlightByDocument.delete(key);
    else inFlightByDocument.set(key, remaining);
  }
}

export function resetDispatchState(): void {
  inFlightByDocument.clear();
}
