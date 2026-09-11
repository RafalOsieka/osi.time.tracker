import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_PROTOCOL_VERSION } from '@osi/extension-protocol';
import type { JsonValue, RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
} from '../../src/approvals/approvals.js';
import { resetDispatchState } from '../../src/worker/dispatch.js';
import { WORKER_PORT_NAME, attachWorkerPort, type WorkerPort } from '../../src/worker/ports.js';
import type { RuntimeSender } from '../../src/worker/sender.js';

const website = 'http://localhost:3000';
const tracker = 'https://op.example.com';
const extensionId = 'osi-extension-id';
const secret = 'super-secret';

function trustedSender(): RuntimeSender {
  return {
    id: extensionId,
    origin: website,
    url: `${website}/`,
    frameId: 0,
    tabId: 1,
    documentId: 'doc-port',
  };
}

async function approved() {
  const store = createMemoryApprovalStore();
  const permissions = createMemoryHostPermissions();
  const approvals = new ApprovalService(store, permissions);
  await approvals.approveWebsite(website);
  await approvals.approveDestination(website, 'openproject', tracker);
  return approvals;
}

class FakePort implements WorkerPort {
  name = WORKER_PORT_NAME;
  messages: JsonValue[] = [];
  disconnected = false;
  private readonly messageListeners: Array<(message: JsonValue) => void> = [];
  private readonly disconnectListeners: Array<() => void> = [];

  constructor(readonly sender: RuntimeSender) {}

  postMessage(message: JsonValue): void {
    if (this.disconnected) throw new Error('disconnected');
    this.messages.push(message);
  }

  disconnect(): void {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const listener of this.disconnectListeners) listener();
  }

  onMessage = {
    addListener: (callback: (message: JsonValue) => void) => {
      this.messageListeners.push(callback);
    },
  };

  onDisconnect = {
    addListener: (callback: () => void) => {
      this.disconnectListeners.push(callback);
    },
  };

  emit(message: JsonValue): void {
    for (const listener of this.messageListeners) listener(message);
  }
}

function hangingFetch(signal?: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

afterEach(() => {
  resetDispatchState();
});

describe('worker runtime ports', () => {
  it.each(['website', 'destination'] as const)(
    'disconnects an idle port when its %s browser permission is removed with settings closed',
    async (scope) => {
      const permissions = createMemoryHostPermissions();
      const approvals = new ApprovalService(createMemoryApprovalStore(), permissions);
      await approvals.approveWebsite(website);
      await approvals.approveDestination(website, 'openproject', tracker);
      const port = new FakePort(trustedSender());
      attachWorkerPort(port, { extensionId, approvals });
      port.emit({
        type: 'handshake',
        protocolVersion: EXTENSION_PROTOCOL_VERSION,
        destination: { provider: 'openproject', baseUrl: tracker },
      });
      await vi.waitFor(() => expect(port.messages).toHaveLength(1));
      await permissions.remove(`${scope === 'website' ? website : tracker}/*`);
      await vi.waitFor(() => expect(port.disconnected).toBe(true));
      expect((await approvals.list()).websites).toHaveLength(1);
    },
  );

  it('handshakes and dispatches over a document-bound port', async () => {
    const approvals = await approved();
    const port = new FakePort(trustedSender());
    attachWorkerPort(port, {
      extensionId,
      approvals,
      createAdapter: () =>
        ({
          searchIssues: async () => [{ remoteIssueId: '1', title: 'Issue' }],
          getIssueById: async () => null,
          getActivityOptions: async () => [],
          getCurrentAccount: async () => ({ id: 'u', name: 'Ada' }),
          fetchTimeLogs: async () => [],
          fetchTimeLogsInRange: async () => [],
          createTimeEntry: async () => ({ remoteLogId: 'log-1' }),
          deleteTimeEntry: async () => ({ status: 'deleted' as const }),
        }) satisfies RemoteTrackerAdapter,
    });
    port.emit({ type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION });
    await vi.waitFor(() => expect(port.messages).toHaveLength(1));
    expect(port.messages[0]).toMatchObject({ type: 'handshake-result', protocolVersion: 1 });

    port.emit({
      type: 'operation',
      requestId: 'req-1',
      operation: 'getCurrentAccount',
      provider: 'openproject',
      baseUrl: tracker,
      input: null,
      secret,
    });
    await vi.waitFor(() => expect(port.messages).toHaveLength(2));
    expect(port.messages[1]).toMatchObject({
      ok: true,
      operation: 'getCurrentAccount',
      result: { id: 'u', name: 'Ada' },
    });
    expect(JSON.stringify(port.messages)).not.toContain(secret);
  });

  it('disconnects unknown ports and ignores foreign senders', async () => {
    const approvals = await approved();
    const unknown = new FakePort(trustedSender());
    unknown.name = 'other';
    attachWorkerPort(unknown, { extensionId, approvals });
    expect(unknown.disconnected).toBe(true);

    const foreign = new FakePort({ ...trustedSender(), id: 'other-extension' });
    const fetchImpl = vi.fn(async () => new Response('{}'));
    attachWorkerPort(foreign, { extensionId, approvals, fetchImpl });
    foreign.emit({
      type: 'operation',
      requestId: 'req-1',
      operation: 'getCurrentAccount',
      provider: 'openproject',
      baseUrl: tracker,
      input: null,
      secret,
    });
    await vi.waitFor(() => expect(foreign.messages).toHaveLength(1));
    expect(foreign.messages[0]).toMatchObject({ ok: false, error: { kind: 'permission' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aborts in-flight create on port disposal and does not replay it', async () => {
    const approvals = await approved();
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      hangingFetch(init?.signal),
    );
    const port = new FakePort(trustedSender());
    attachWorkerPort(port, { extensionId, approvals, fetchImpl });
    port.emit({
      type: 'operation',
      requestId: 'req-create',
      operation: 'createTimeEntry',
      provider: 'openproject',
      baseUrl: tracker,
      input: {
        remoteIssueId: '1',
        spentOn: '2026-01-01',
        durationSeconds: 3600,
        activityId: 'a',
      },
      secret,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    port.disconnect();
    await vi.waitFor(() => expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true));
    expect(port.messages).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
