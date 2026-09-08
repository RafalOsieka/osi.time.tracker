import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/extension-protocol';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import type { ApprovalService } from '../approvals/approvals.js';
import { WORKER_PORT_NAME } from '../port-name.js';
import { handleHandshake, handleOperation, type CreateProviderAdapter } from './dispatch.js';
import { type RuntimeSender } from './sender.js';

export { WORKER_PORT_NAME };

export interface WorkerPort {
  name: string;
  sender?: RuntimeSender;
  postMessage: (message: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (callback: (message: unknown) => void) => void };
  onDisconnect: { addListener: (callback: () => void) => void };
}

export interface WorkerPortOptions {
  extensionId: string;
  approvals: ApprovalService;
  fetchImpl?: typeof fetch;
  createAdapter?: CreateProviderAdapter;
  operationTimeoutMs?: number;
}

function cloneJson(value: unknown): JsonValue | undefined {
  try {
    // SAFETY: port messages are untyped; JSON round-trip is the validation boundary.
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

function safePost(port: WorkerPort, message: unknown): void {
  try {
    port.postMessage(message);
  } catch {
    // The document is already gone; in-memory requests are dropped.
  }
}

export function runtimeSenderFromChrome(sender?: ChromeRuntimeSender): RuntimeSender {
  return {
    id: sender?.id,
    origin: sender?.origin,
    url: sender?.url,
    frameId: sender?.frameId,
    tabId: sender?.tab?.id,
    documentId: sender?.documentId,
  };
}

export function wrapChromePort(port: ChromeRuntimePort): WorkerPort {
  return {
    name: port.name,
    sender: runtimeSenderFromChrome(port.sender),
    postMessage: (message) => port.postMessage(message),
    disconnect: () => port.disconnect(),
    onMessage: port.onMessage,
    onDisconnect: port.onDisconnect,
  };
}

/** Binds one content-script port to handshake/operation dispatch. */
export function attachWorkerPort(port: WorkerPort, options: WorkerPortOptions): void {
  if (port.name !== WORKER_PORT_NAME) {
    port.disconnect();
    return;
  }
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((message) => {
    void handlePortMessage(port, message, options, controller.signal);
  });
}

async function handlePortMessage(
  port: WorkerPort,
  message: unknown,
  options: WorkerPortOptions,
  signal: AbortSignal,
): Promise<void> {
  const value = cloneJson(message);
  if (value === undefined) {
    safePost(port, {
      kind: 'malformed',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed,
    });
    return;
  }
  const sender = port.sender ?? {};
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'handshake'
  ) {
    const result = await handleHandshake({
      sender,
      expectedExtensionId: options.extensionId,
      value,
      approvals: options.approvals,
    });
    safePost(port, result);
    return;
  }
  const result = await handleOperation({
    sender,
    expectedExtensionId: options.extensionId,
    value,
    approvals: options.approvals,
    fetchImpl: options.fetchImpl,
    signal,
    createAdapter: options.createAdapter,
    operationTimeoutMs: options.operationTimeoutMs,
  });
  if (signal.aborted) return;
  safePost(port, result);
}

export function listenForWorkerPorts(
  options: WorkerPortOptions & {
    onConnect: (listener: (port: WorkerPort) => void) => void;
  },
): void {
  options.onConnect((port) => attachWorkerPort(port, options));
}

export function listenForChromePorts(options: WorkerPortOptions): void {
  chrome.runtime.onConnect.addListener((port) => {
    attachWorkerPort(wrapChromePort(port), options);
  });
}
