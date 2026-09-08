import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  parseHandshakeRequest,
  parseOperationRequest,
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
} from '@osi/remote-trackers/contracts';
import { CanonicalizationError } from '../security/canonicalize.js';
import { ApprovalService } from '../approvals/approvals.js';
import { createProviderAdapter } from '../providers.js';
import { createGuardedTransport } from '../transport/guarded-transport.js';

const inFlightByDocument = new Map<string, number>();

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
      try {
        const result = await adapter.createTimeEntry(request.input);
        return {
          type: 'operation-result',
          requestId: request.requestId,
          operation: 'createTimeEntry',
          ok: true,
          result,
        };
      } catch (error) {
        if (error instanceof ExtensionProtocolError && error.kind === 'timeout') {
          throw new ExtensionProtocolError(
            'unknown-create',
            EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate,
          );
        }
        throw error;
      }
    }
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

export async function handleHandshake(
  senderOrigin: string,
  value: JsonValue,
  approvals: ApprovalService,
): Promise<HandshakeResult | SafeWireError> {
  const parsed = parseHandshakeRequest(value);
  if (!parsed.success) return parsed.error;
  const listed = await approvals.list();
  if (!listed.websites.some((item) => item.origin === senderOrigin)) {
    return {
      kind: 'permission',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved,
    };
  }
  let destinationApproved: boolean | undefined;
  if (parsed.data.destination) {
    try {
      await approvals.authorizedDestination(
        senderOrigin,
        parsed.data.destination.provider,
        parsed.data.destination.baseUrl,
      );
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
  senderOrigin: string;
  value: JsonValue;
  approvals: ApprovalService;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<OperationResult | SafeWireError> {
  const parsed = parseOperationRequest(options.value);
  if (!parsed.success) return parsed.error;
  const request = parsed.data;
  const current = inFlightByDocument.get(options.senderOrigin) ?? 0;
  if (current >= EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument) {
    return failure(request, {
      kind: 'limit',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.limit,
    });
  }
  inFlightByDocument.set(options.senderOrigin, current + 1);
  const controller = new AbortController();
  let unregister = () => {};
  try {
    const approval = await options.approvals.authorizedDestination(
      options.senderOrigin,
      request.provider,
      request.baseUrl,
    );
    unregister = options.approvals.registerInFlight(approval.origin, {
      abort: () => controller.abort(),
    });
    const transport = createGuardedTransport({
      approval,
      fetchImpl: options.fetchImpl,
      signal: options.signal
        ? AbortSignal.any([options.signal, controller.signal])
        : controller.signal,
    });
    const adapter = createProviderAdapter(
      request.provider,
      transport,
      request.baseUrl,
      request.secret,
    );
    return await executeOperation(adapter, request);
  } catch (error) {
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
    const remaining = (inFlightByDocument.get(options.senderOrigin) ?? 1) - 1;
    if (remaining <= 0) inFlightByDocument.delete(options.senderOrigin);
    else inFlightByDocument.set(options.senderOrigin, remaining);
  }
}

export function resetDispatchState(): void {
  inFlightByDocument.clear();
}
