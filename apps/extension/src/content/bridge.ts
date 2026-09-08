import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_PROTOCOL_VERSION,
  connectMessageSchema,
} from '@osi/extension-protocol';

export interface ConnectEventLike {
  origin: string;
  source: unknown;
  data: unknown;
  ports: Array<PagePortLike>;
}

export interface PagePortLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  start?: () => void;
  addEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void;
  removeEventListener?: (type: 'message', listener: (event: { data: unknown }) => void) => void;
}

export interface WorkerPortLike {
  postMessage: (message: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (callback: (message: unknown) => void) => void };
  onDisconnect: { addListener: (callback: () => void) => void };
}

export interface ConnectContext {
  expectedOrigin: string;
  source: unknown;
  isTopFrame: boolean;
}

function isConnectEnvelope(data: unknown): data is { channel: unknown; type: unknown } {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
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
  const onPageMessage = (event: { data: unknown }) => {
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
