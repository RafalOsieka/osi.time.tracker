import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_CHANNEL, EXTENSION_PROTOCOL_VERSION } from '@osi/extension-protocol';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import {
  acceptConnectEvent,
  pipePorts,
  type PagePortLike,
  type WorkerPortLike,
} from '../../src/content/bridge.js';
import { PendingRequestTable } from '../../src/content/pending-requests.js';
import {
  contentScriptId,
  reconcileWebsiteContentScripts,
  registerWebsiteContentScript,
} from '../../src/content/registration.js';

const origin = 'http://localhost:3000';
const source = { id: 'page' };

function connectData(protocolVersion: number = EXTENSION_PROTOCOL_VERSION) {
  return {
    channel: EXTENSION_CHANNEL,
    type: 'connect',
    protocolVersion,
  };
}

function fakePagePort(): PagePortLike & {
  messages: JsonValue[];
  closed: boolean;
  listeners: Array<(event: { data: JsonValue }) => void>;
} {
  const listeners: Array<(event: { data: JsonValue }) => void> = [];
  return {
    messages: [],
    closed: false,
    listeners,
    postMessage(message) {
      this.messages.push(message);
    },
    close() {
      this.closed = true;
    },
    start() {},
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    removeEventListener(_type, listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}

function fakeWorkerPort(): WorkerPortLike & {
  messages: JsonValue[];
  disconnected: boolean;
  messageListeners: Array<(message: JsonValue) => void>;
  disconnectListeners: Array<() => void>;
} {
  const messageListeners: Array<(message: JsonValue) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  const port: WorkerPortLike & {
    messages: JsonValue[];
    disconnected: boolean;
    messageListeners: Array<(message: JsonValue) => void>;
    disconnectListeners: Array<() => void>;
  } = {
    messages: [],
    disconnected: false,
    messageListeners,
    disconnectListeners,
    postMessage(message) {
      port.messages.push(message);
    },
    disconnect() {
      port.disconnected = true;
      for (const listener of disconnectListeners) listener();
    },
    onMessage: {
      addListener(callback) {
        messageListeners.push(callback);
      },
    },
    onDisconnect: {
      addListener(callback) {
        disconnectListeners.push(callback);
      },
    },
  };
  return port;
}

function fakeScripting() {
  const scripts = new Map<string, { id: string; matches: string[] }>();
  return {
    scripts,
    registerContentScripts: async (
      entries: Array<{ id: string; matches: string[]; js: string[]; world: string }>,
    ) => {
      for (const entry of entries) scripts.set(entry.id, { id: entry.id, matches: entry.matches });
    },
    unregisterContentScripts: async (filter: { ids: string[] }) => {
      for (const id of filter.ids) scripts.delete(id);
    },
    getRegisteredContentScripts: async () => [...scripts.values()],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('content bridge', () => {
  it('accepts an exact-origin top-frame connect', () => {
    const pagePort = fakePagePort();
    const accepted = acceptConnectEvent(
      { origin, source, data: connectData(), ports: [pagePort] },
      { expectedOrigin: origin, source, isTopFrame: true },
    );
    expect(accepted).toBe(pagePort);
  });

  it('rejects a different origin or source', () => {
    const pagePort = fakePagePort();
    expect(
      acceptConnectEvent(
        { origin: 'https://evil.example', source, data: connectData(), ports: [pagePort] },
        { expectedOrigin: origin, source, isTopFrame: true },
      ),
    ).toBeUndefined();
    expect(
      acceptConnectEvent(
        { origin, source: { id: 'other' }, data: connectData(), ports: [pagePort] },
        { expectedOrigin: origin, source, isTopFrame: true },
      ),
    ).toBeUndefined();
  });

  it('rejects iframe connects', () => {
    const pagePort = fakePagePort();
    expect(
      acceptConnectEvent(
        { origin, source, data: connectData(), ports: [pagePort] },
        { expectedOrigin: origin, source, isTopFrame: false },
      ),
    ).toBeUndefined();
  });

  it('answers incompatible handshakes without connecting', () => {
    const pagePort = fakePagePort();
    const accepted = acceptConnectEvent(
      { origin, source, data: connectData(2), ports: [pagePort] },
      { expectedOrigin: origin, source, isTopFrame: true },
    );
    expect(accepted).toBeUndefined();
    expect(pagePort.messages[0]).toMatchObject({ kind: 'incompatible' });
    expect(pagePort.closed).toBe(true);
  });

  it('drops late worker replies after disconnect', () => {
    const pagePort = fakePagePort();
    const workerPort = fakeWorkerPort();
    const close = pipePorts(pagePort, workerPort);
    pagePort.listeners[0]?.({ data: { type: 'handshake' } });
    expect(workerPort.messages).toHaveLength(1);
    close();
    workerPort.messageListeners[0]?.({ type: 'handshake-result' });
    expect(pagePort.messages).toHaveLength(0);
    expect(workerPort.disconnected).toBe(true);
  });

  it('consumes page disposal locally and disconnects both ports exactly once', () => {
    const pagePort = fakePagePort();
    const workerPort = fakeWorkerPort();
    const disconnect = vi.spyOn(workerPort, 'disconnect');
    const close = pipePorts(pagePort, workerPort);
    const onPageMessage = pagePort.listeners[0];
    onPageMessage?.({ data: { type: 'osi-extension-disconnect' } });
    onPageMessage?.({ data: { type: 'handshake' } });
    workerPort.messageListeners[0]?.({ type: 'handshake-result' });
    close();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(pagePort.closed).toBe(true);
    expect(pagePort.listeners).toHaveLength(0);
    expect(workerPort.messages).toEqual([]);
    expect(pagePort.messages).toEqual([]);
  });

  it('disposes all content connections on pagehide and allows a restored page to reconnect', async () => {
    const windowRef = new (class extends EventTarget {
      location = { origin };
      get top() {
        return this;
      }
    })();
    const workerPort = fakeWorkerPort();
    const disconnect = vi.spyOn(workerPort, 'disconnect');
    const connect = vi.fn(() => workerPort);
    vi.stubGlobal('window', windowRef);
    vi.stubGlobal('chrome', { runtime: { connect } });
    vi.resetModules();
    await import('../../src/content.js');
    const first = fakePagePort();
    const second = fakePagePort();
    const connectPage = (pagePort: PagePortLike) => {
      windowRef.dispatchEvent(
        Object.assign(new Event('message'), {
          source: windowRef,
          origin,
          data: connectData(),
          ports: [pagePort],
        }),
      );
    };
    connectPage(first);
    connectPage(second);
    windowRef.dispatchEvent(new Event('pagehide'));
    expect(first.closed).toBe(true);
    expect(second.closed).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(2);
    windowRef.dispatchEvent(new Event('pagehide'));
    expect(disconnect).toHaveBeenCalledTimes(2);
    const restored = fakePagePort();
    connectPage(restored);
    expect(restored.closed).toBe(false);
    expect(connect).toHaveBeenCalledTimes(3);
    restored.listeners[0]?.({ data: { type: 'osi-extension-disconnect' } });
    expect(restored.closed).toBe(true);
  });
});

describe('pending request correlation', () => {
  it('matches replies by request id and operation', () => {
    const table = new PendingRequestTable(() => {});
    expect(table.add('req-1', 'searchIssues')).toBe(true);
    expect(table.take('req-1', 'searchIssues')).toBe('matched');
    expect(table.take('req-1', 'searchIssues')).toBe('late');
  });

  it('does not settle a request from a mismatched operation reply', () => {
    const table = new PendingRequestTable(() => {});
    table.add('req-1', 'searchIssues');
    expect(table.take('req-1', 'getIssueById')).toBe('mismatch');
    expect(table.take('req-1', 'searchIssues')).toBe('matched');
  });

  it('times out unmatched requests', () => {
    vi.useFakeTimers();
    const timeouts: string[] = [];
    const table = new PendingRequestTable((error) => timeouts.push(error.requestId), 50);
    table.add('req-2', 'createTimeEntry');
    vi.advanceTimersByTime(50);
    expect(timeouts).toEqual(['req-2']);
    expect(table.take('req-2', 'createTimeEntry')).toBe('late');
  });

  it('clears pending work on disconnect without firing timeouts', () => {
    vi.useFakeTimers();
    const timeouts: string[] = [];
    const table = new PendingRequestTable((error) => timeouts.push(error.requestId), 50);
    table.add('req-1', 'getCurrentAccount');
    table.disconnect();
    vi.advanceTimersByTime(50);
    expect(timeouts).toEqual([]);
    expect(table.take('req-1', 'getCurrentAccount')).toBe('late');
  });
});

describe('content script registration', () => {
  it('registers the isolated content script for an approved origin', async () => {
    const scripting = fakeScripting();
    await registerWebsiteContentScript(origin, scripting);
    expect(scripting.scripts.get(contentScriptId(origin))).toMatchObject({
      matches: [`${origin}/*`],
    });
    await reconcileWebsiteContentScripts([], scripting);
    expect(scripting.scripts.size).toBe(0);
  });
});
