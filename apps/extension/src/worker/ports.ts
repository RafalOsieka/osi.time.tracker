import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/extension-protocol';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import type { ApprovalService, DestinationApproval } from '../approvals/approvals.js';
import { WORKER_PORT_NAME } from '../port-name.js';
import { handleHandshake, handleOperation, type CreateProviderAdapter } from './dispatch.js';
import { isTrustedDocumentSender, type RuntimeSender } from './sender.js';

export { WORKER_PORT_NAME };

export interface WorkerPort {
  name: string;
  sender?: RuntimeSender;
  postMessage: (message: JsonValue) => void;
  disconnect: () => void;
  onMessage: { addListener: (callback: (message: JsonValue) => void) => void };
  onDisconnect: { addListener: (callback: () => void) => void };
}

export interface WorkerPortOptions {
  extensionId: string;
  approvals: ApprovalService;
  fetchImpl?: typeof fetch;
  createAdapter?: CreateProviderAdapter;
  operationTimeoutMs?: number;
}

function cloneJson(value: JsonValue): JsonValue | undefined {
  try {
    // SAFETY: port messages are untyped; JSON round-trip is the validation boundary.
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return undefined;
  }
}

function safePost(port: WorkerPort, message: JsonValue): void {
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
  const destinations = new Map<string, () => void>();
  const unsubscribe = options.approvals.subscribe(() => {
    void checkWebsite().catch(disconnect);
  });

  function dispose(): void {
    controller.abort();
    unsubscribe();
    for (const unregister of destinations.values()) unregister();
    destinations.clear();
  }

  function disconnect(): void {
    dispose();
    port.disconnect();
  }

  async function checkWebsite(): Promise<void> {
    const state = await options.approvals.list();
    const sender = port.sender ?? {};
    if (
      !isTrustedDocumentSender(
        sender,
        options.extensionId,
        state.websites.map((item) => item.origin),
      ) ||
      !sender.origin ||
      !(await options.approvals.hasHostPermission(sender.origin))
    )
      disconnect();
  }

  function onAuthorized(approval: DestinationApproval): void {
    if (controller.signal.aborted) return;
    const key = JSON.stringify(approval);
    if (destinations.has(key)) return;
    destinations.set(key, options.approvals.registerInFlight(approval, { abort: disconnect }));
  }

  port.onDisconnect.addListener(dispose);
  port.onMessage.addListener((message) => {
    if (controller.signal.aborted) return;
    void handlePortMessage(port, message, options, controller.signal, onAuthorized);
  });
}

async function handlePortMessage(
  port: WorkerPort,
  message: JsonValue,
  options: WorkerPortOptions,
  signal: AbortSignal,
  onAuthorized: (approval: DestinationApproval) => void,
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
  if (value instanceof Object && !Array.isArray(value) && value.type === 'handshake') {
    const result = await handleHandshake({
      sender,
      expectedExtensionId: options.extensionId,
      value,
      approvals: options.approvals,
      onAuthorized,
    });
    safePost(port, result);
    return;
  }
  const result = await handleOperation({
    sender,
    expectedExtensionId: options.extensionId,
    value,
    approvals: options.approvals,
    onAuthorized,
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
