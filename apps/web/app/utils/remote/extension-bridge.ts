import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_PROTOCOL_VERSION,
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  parseHandshakeResult,
  parseMatchedOperationResult,
  reconstructProtocolError,
  safeWireErrorSchema,
  type DestinationSelector,
  type ExtensionOperationName,
  type HandshakeResult,
  type OperationRequest,
} from '@osi/extension-protocol';
import type { JsonValue, TrackerSystemType } from '@osi/remote-trackers/contracts';

export interface ExtensionWindow {
  readonly location: { readonly origin: string };
  postMessage(message: unknown, targetOrigin: string, transfer?: unknown[]): void;
}

export interface ExtensionMessagePort {
  start?: () => void;
  close: () => void;
  postMessage: (message: unknown) => void;
  addEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void;
  removeEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void;
}

export interface ExtensionChannel {
  port1: ExtensionMessagePort;
  port2: ExtensionMessagePort;
}

export interface ExtensionBridgeOptions {
  window: ExtensionWindow;
  createChannel?: () => ExtensionChannel;
  schedule?: typeof setTimeout;
  unschedule?: typeof clearTimeout;
  nextRequestId?: () => string;
  handshakeTimeoutMs?: number;
  pageDeadlineMs?: number;
}

type OperationInput = OperationRequest['input'];

interface PendingOperation {
  operation: ExtensionOperationName;
  isCreate: boolean;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

function cloneJson(value: unknown): JsonValue | undefined {
  try {
    // SAFETY: JSON.parse of JSON.stringify always yields a JSON value.
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

function unavailableError(): ExtensionProtocolError {
  return new ExtensionProtocolError('unavailable', EXTENSION_ERROR_MESSAGE_KEYS.unavailable);
}

function timeoutError(): ExtensionProtocolError {
  return new ExtensionProtocolError('timeout', EXTENSION_ERROR_MESSAGE_KEYS.timeout);
}

function unknownCreateError(): ExtensionProtocolError {
  return new ExtensionProtocolError('unknown-create', EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate);
}

function limitError(): ExtensionProtocolError {
  return new ExtensionProtocolError('limit', EXTENSION_ERROR_MESSAGE_KEYS.limit);
}

function malformedError(): ExtensionProtocolError {
  return new ExtensionProtocolError('malformed', EXTENSION_ERROR_MESSAGE_KEYS.malformed);
}

function toProtocolError(error: { kind: string; messageKey: string; status?: number }) {
  const parsed = safeWireErrorSchema.safeParse(error);
  if (!parsed.success) return malformedError();
  const reconstructed = reconstructProtocolError(parsed.data);
  if (reconstructed instanceof ExtensionProtocolError) return reconstructed;
  return reconstructed;
}

let requestSeq = 0;

function defaultRequestId(): string {
  requestSeq += 1;
  return `r${requestSeq}_${Date.now().toString(36)}`;
}

/**
 * Page-side document bridge: same-window connect, credential-free handshake,
 * and correlated operation requests over a transferred MessagePort.
 */
export class ExtensionDocumentBridge {
  private readonly pending = new Map<string, PendingOperation>();
  private handshakeWaiter:
    | {
        resolve: (value: HandshakeResult) => void;
        reject: (error: unknown) => void;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    | undefined;
  private closed = false;
  private readonly port: ExtensionMessagePort;
  private readonly onMessage = (event: { data: unknown }) => {
    this.handleMessage(event.data);
  };

  constructor(private readonly options: ExtensionBridgeOptions) {
    const channel = (options.createChannel ?? (() => new MessageChannel()))();
    this.port = channel.port1;
    this.port.start?.();
    this.port.addEventListener('message', this.onMessage);
    options.window.postMessage(
      {
        channel: EXTENSION_CHANNEL,
        type: 'connect',
        protocolVersion: EXTENSION_PROTOCOL_VERSION,
      },
      options.window.location.origin,
      [channel.port2],
    );
  }

  async handshake(destination?: DestinationSelector): Promise<HandshakeResult> {
    if (this.closed) throw unavailableError();
    if (this.handshakeWaiter) {
      throw malformedError();
    }
    return new Promise<HandshakeResult>((resolve, reject) => {
      const timeoutId = (this.options.schedule ?? setTimeout)(() => {
        this.handshakeWaiter = undefined;
        reject(unavailableError());
      }, this.options.handshakeTimeoutMs ?? EXTENSION_RESOURCE_LIMITS.pageDeadlineMs);
      this.handshakeWaiter = { resolve, reject, timeoutId };
      this.port.postMessage({
        type: 'handshake',
        protocolVersion: EXTENSION_PROTOCOL_VERSION,
        ...(destination ? { destination } : {}),
      });
    });
  }

  async request(input: {
    operation: ExtensionOperationName;
    provider: TrackerSystemType;
    baseUrl: string;
    secret: string;
    payload: OperationInput;
  }): Promise<unknown> {
    if (this.closed) throw unavailableError();
    if (this.pending.size >= EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument) {
      throw limitError();
    }
    const requestId = (this.options.nextRequestId ?? defaultRequestId)();
    const envelope = {
      type: 'operation',
      requestId,
      operation: input.operation,
      provider: input.provider,
      baseUrl: input.baseUrl,
      secret: input.secret,
      input: input.payload,
    };
    return new Promise((resolve, reject) => {
      const timeoutId = (this.options.schedule ?? setTimeout)(() => {
        const pending = this.pending.get(requestId);
        this.pending.delete(requestId);
        reject(pending?.isCreate ? unknownCreateError() : timeoutError());
      }, this.options.pageDeadlineMs ?? EXTENSION_RESOURCE_LIMITS.pageDeadlineMs);
      this.pending.set(requestId, {
        operation: input.operation,
        isCreate: input.operation === 'createTimeEntry',
        resolve,
        reject,
        timeoutId,
      });
      this.port.postMessage(envelope);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.port.removeEventListener('message', this.onMessage);
    const handshake = this.handshakeWaiter;
    this.handshakeWaiter = undefined;
    if (handshake) {
      (this.options.unschedule ?? clearTimeout)(handshake.timeoutId);
      handshake.reject(unavailableError());
    }
    for (const [requestId, pending] of this.pending) {
      (this.options.unschedule ?? clearTimeout)(pending.timeoutId);
      pending.reject(pending.isCreate ? unknownCreateError() : unavailableError());
      this.pending.delete(requestId);
    }
    try {
      this.port.close();
    } catch {
      // already closed
    }
  }

  private handleMessage(data: unknown): void {
    const value = cloneJson(data);
    if (value === undefined) return;

    if (this.handshakeWaiter) {
      const handshake = parseHandshakeResult(value);
      if (handshake.success) {
        const waiter = this.handshakeWaiter;
        this.handshakeWaiter = undefined;
        (this.options.unschedule ?? clearTimeout)(waiter.timeoutId);
        waiter.resolve(handshake.data);
        return;
      }
      const wire = safeWireErrorSchema.safeParse(value);
      if (wire.success) {
        const waiter = this.handshakeWaiter;
        this.handshakeWaiter = undefined;
        (this.options.unschedule ?? clearTimeout)(waiter.timeoutId);
        waiter.reject(toProtocolError(wire.data));
        return;
      }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const requestId = value.requestId;
      if (typeof requestId === 'string') {
        const pending = this.pending.get(requestId);
        if (!pending) return;
        const parsed = parseMatchedOperationResult(pending.operation, value);
        if (!parsed.success) return;
        this.pending.delete(requestId);
        (this.options.unschedule ?? clearTimeout)(pending.timeoutId);
        if (parsed.data.ok) {
          pending.resolve(parsed.data.result);
          return;
        }
        pending.reject(toProtocolError(parsed.data.error));
      }
    }
  }
}
