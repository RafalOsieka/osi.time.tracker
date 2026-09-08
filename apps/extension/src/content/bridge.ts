import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_PROTOCOL_VERSION,
  connectMessageSchema,
} from '@osi/extension-protocol';
import type { JsonValue } from '@osi/remote-trackers/contracts';

export interface ConnectEventLike {
  origin: string;
  source: object;
  data: JsonValue;
  ports: Array<PagePortLike>;
}

export interface PagePortLike {
  postMessage: (message: JsonValue) => void;
  close: () => void;
  start?: () => void;
  addEventListener: (type: 'message', listener: (event: { data: JsonValue }) => void) => void;
  removeEventListener?: (type: 'message', listener: (event: { data: JsonValue }) => void) => void;
}

export interface WorkerPortLike {
  postMessage: (message: JsonValue) => void;
  disconnect: () => void;
  onMessage: { addListener: (callback: (message: JsonValue) => void) => void };
  onDisconnect: { addListener: (callback: () => void) => void };
}

export interface ConnectContext {
  expectedOrigin: string;
  source: object;
  isTopFrame: boolean;
}

function isConnectEnvelope(data: JsonValue): data is { readonly [key: string]: JsonValue } {
  return data instanceof Object && !Array.isArray(data);
}

/**
 * Accepts a same-window, exact-origin connect from the top frame only.
 * Incompatible versions are answered on the transferred port, then closed.
 */
export function acceptConnectEvent(
  event: ConnectEventLike,
  context: ConnectContext,
): PagePortLike | undefined {
  if (!context.isTopFrame) return undefined;
  if (event.source !== context.source) return undefined;
  if (event.origin !== context.expectedOrigin) return undefined;
  if (!isConnectEnvelope(event.data)) return undefined;
  if (event.data.channel !== EXTENSION_CHANNEL || event.data.type !== 'connect') return undefined;
  const pagePort = event.ports[0];
  if (!pagePort) return undefined;
  const parsed = connectMessageSchema.safeParse(event.data);
  if (!parsed.success) {
    pagePort.postMessage({
      kind: 'incompatible',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
    });
    pagePort.close();
    return undefined;
  }
  pagePort.start?.();
  return pagePort;
}

/** Forwards messages until either port disconnects, then drops late replies. */
export function pipePorts(pagePort: PagePortLike, workerPort: WorkerPortLike): () => void {
  let closed = false;
  const onPageMessage = (event: { data: JsonValue }) => {
    if (closed) return;
    workerPort.postMessage(event.data);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    pagePort.removeEventListener?.('message', onPageMessage);
    try {
      pagePort.close();
    } catch {
      // already closed
    }
    try {
      workerPort.disconnect();
    } catch {
      // already disconnected
    }
  };
  pagePort.addEventListener('message', onPageMessage);
  workerPort.onMessage.addListener((message) => {
    if (closed) return;
    pagePort.postMessage(message);
  });
  workerPort.onDisconnect.addListener(close);
  return close;
}
