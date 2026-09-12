import { describe, expect, it, vi } from 'vitest';
import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_PROTOCOL_VERSION,
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  handshakeRequestSchema,
  operationRequestSchema,
  type ExtensionOperationName,
  type HandshakeRequest,
  type HandshakeResult,
  type OperationFailure,
  type OperationRequest,
  type OperationSuccess,
  type SafeWireError,
} from '@osi/extension-protocol';
import { RemoteAdapterError, type JsonValue } from '@osi/remote-trackers/contracts';
import { createRemoteAdapter } from '../../app/utils/remote/create-remote-adapter';
import {
  openExtensionBridge,
  probeExtensionAvailability,
} from '../../app/utils/remote/extension-availability';
import type {
  ExtensionBridgeOptions,
  ExtensionChannel,
  ExtensionMessagePort,
  ExtensionWindow,
} from '../../app/utils/remote/extension-bridge';
import { ExtensionDocumentBridge } from '../../app/utils/remote/extension-bridge';
import { ExtensionExecutionAdapter } from '../../app/utils/remote/extension-execution-adapter';
import { ExtensionOperationGate } from '../../app/utils/remote/extension-operation-gate';
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import type { TrackerDto } from '../../shared/types/tracker';

/** Resolves once pending microtasks settle, without a fixed timer wait. */
function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

const config: TrackerDto = {
  id: 'config-1',
  name: 'OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: false,
  roundingRule: 'none',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const issue = { remoteIssueId: '42', title: 'Fix login' };
const lookup = { result: issue, inScope: true };
const project = { remoteProjectId: '3', title: 'Spike Root' };
const account = { id: '7', name: 'Ada' };
const activity = { id: '1', name: 'Development' };
const log = {
  remoteLogId: '88',
  remoteIssueId: '42',
  spentOn: '2026-03-15',
  durationSeconds: 1800,
  activityId: '1',
  activityName: 'Development',
  comment: null,
  remoteUserId: '7',
};

function createLinkedChannel(): ExtensionChannel {
  const port1Listeners = new Set<(event: { data: JsonValue }) => void>();
  const port2Listeners = new Set<(event: { data: JsonValue }) => void>();

  function createPort(
    own: Set<(event: { data: JsonValue }) => void>,
    peer: Set<(event: { data: JsonValue }) => void>,
  ): ExtensionMessagePort {
    let closed = false;
    return {
      start() {},
      close() {
        closed = true;
        own.clear();
      },
      postMessage(message) {
        if (closed) return;
        for (const listener of [...peer]) listener({ data: structuredClone(message) });
      },
      addEventListener(_type, listener) {
        own.add(listener);
      },
      removeEventListener(_type, listener) {
        own.delete(listener);
      },
    };
  }

  return {
    port1: createPort(port1Listeners, port2Listeners),
    port2: createPort(port2Listeners, port1Listeners),
  };
}

function defaultHandshake() {
  return {
    type: 'handshake-result' as const,
    protocolVersion: EXTENSION_PROTOCOL_VERSION,
    supportedOperations: [...EXTENSION_OPERATION_NAMES],
    destinationApproved: true,
  };
}

function operationSuccess(request: {
  requestId: string;
  operation: ExtensionOperationName;
}): OperationSuccess {
  switch (request.operation) {
    case 'searchIssues':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'searchIssues',
        ok: true,
        result: [issue],
      };
    case 'getIssueById':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getIssueById',
        ok: true,
        result: lookup,
      };
    case 'listProjects':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'listProjects',
        ok: true,
        result: [project],
      };
    case 'getActivityOptions':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getActivityOptions',
        ok: true,
        result: [activity],
      };
    case 'getCurrentAccount':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'getCurrentAccount',
        ok: true,
        result: account,
      };
    case 'fetchTimeLogs':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'fetchTimeLogs',
        ok: true,
        result: [log],
      };
    case 'fetchTimeLogsInRange':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'fetchTimeLogsInRange',
        ok: true,
        result: [log],
      };
    case 'createTimeEntry':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'createTimeEntry',
        ok: true,
        result: { remoteLogId: '99' },
      };
    case 'deleteTimeEntry':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: 'deleteTimeEntry',
        ok: true,
        result: { status: 'deleted' },
      };
    default: {
      const _exhaustive: never = request.operation;
      return _exhaustive;
    }
  }
}

function createFakeHost(options?: {
  handshake?: (message: HandshakeRequest) => HandshakeResult | SafeWireError | JsonValue;
  operation?: (message: OperationRequest) => OperationSuccess | OperationFailure | undefined;
}) {
  const connectMessages: Array<{ message: JsonValue; origin: string }> = [];
  const portMessages: JsonValue[] = [];
  const windowRef: ExtensionWindow = {
    location: { origin: 'https://app.example.com' },
    postMessage(message, origin, transfer) {
      connectMessages.push({ message, origin });
      const pagePort = transfer?.[0];
      pagePort?.addEventListener('message', (event) => {
        const data = event.data;
        portMessages.push(data);
        const handshake = handshakeRequestSchema.safeParse(data);
        if (handshake.success) {
          pagePort.postMessage(
            options?.handshake ? options.handshake(handshake.data) : defaultHandshake(),
          );
          return;
        }
        const operation = operationRequestSchema.safeParse(data);
        if (!operation.success) return;
        const reply = options?.operation
          ? options.operation(operation.data)
          : operationSuccess(operation.data);
        if (reply !== undefined) pagePort.postMessage(reply);
      });
    },
  };

  let requestSeq = 0;
  const bridgeOptions: ExtensionBridgeOptions = {
    window: windowRef,
    createChannel: createLinkedChannel,
    nextRequestId: () => {
      requestSeq += 1;
      return `req${requestSeq}`;
    },
    handshakeTimeoutMs: 20,
    pageDeadlineMs: 20,
  };

  return {
    connectMessages,
    portMessages,
    openBridge: () => new ExtensionDocumentBridge(bridgeOptions),
    bridgeOptions,
  };
}

describe('probeExtensionAvailability', () => {
  it('does not open a bridge during SSR', async () => {
    const openBridge = vi.fn();
    const result = await probeExtensionAvailability({ isClient: false, openBridge });
    expect(openBridge).not.toHaveBeenCalled();
    expect(result.status).toBe('unavailable');
    expect(result.messageKey).toBe(EXTENSION_ERROR_MESSAGE_KEYS.unavailable);
  });

  it('reports incompatible and permission states without a secret', async () => {
    const incompatible = createFakeHost({
      handshake: () => ({
        kind: 'incompatible',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
      }),
    });
    expect(
      await probeExtensionAvailability({
        isClient: true,
        openBridge: incompatible.openBridge,
        destination: { provider: 'openproject', baseUrl: config.baseUrl },
      }),
    ).toMatchObject({
      status: 'incompatible',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
    });
    expect(JSON.stringify(incompatible.portMessages)).not.toContain('secret');

    const permission = createFakeHost({
      handshake: () => ({
        kind: 'permission',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved,
      }),
    });
    expect(
      await probeExtensionAvailability({
        isClient: true,
        openBridge: permission.openBridge,
        destination: { provider: 'openproject', baseUrl: config.baseUrl },
      }),
    ).toMatchObject({
      status: 'websiteUnapproved',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved,
    });
  });

  it.each([false, undefined])(
    'requires explicit destination approval: %s',
    async (destinationApproved) => {
      const host = createFakeHost({
        handshake: () => ({ ...defaultHandshake(), destinationApproved }),
      });
      const result = await probeExtensionAvailability({
        isClient: true,
        openBridge: host.openBridge,
        destination: { provider: 'openproject', baseUrl: config.baseUrl },
      });
      expect(result.status).toBe('permission');
      expect(result.messageKey).toBe(EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved);
    },
  );

  it('throws unavailable when no window is available', () => {
    try {
      openExtensionBridge();
      expect.unreachable('expected openExtensionBridge to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExtensionProtocolError);
      expect(err).toMatchObject({
        kind: 'unavailable',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
      });
    }
  });

  it('maps unexpected probe failures to unavailable', async () => {
    const result = await probeExtensionAvailability({
      isClient: true,
      openBridge: () => {
        throw new Error('boom');
      },
    });
    expect(result).toEqual({
      status: 'unavailable',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
    });
  });

  it.each(['timeout', 'malformed', 'limit'] as const)(
    'treats handshake %s as unavailable, not a permission failure',
    async (kind) => {
      const host = createFakeHost({
        handshake: () => ({
          kind,
          messageKey: EXTENSION_ERROR_MESSAGE_KEYS[kind],
        }),
      });
      const result = await probeExtensionAvailability({
        isClient: true,
        openBridge: host.openBridge,
        destination: { provider: 'openproject', baseUrl: config.baseUrl },
      });
      expect(result).toEqual({
        status: 'unavailable',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS[kind],
      });
    },
  );
});

describe('ExtensionExecutionAdapter', () => {
  it.each([
    { reply: { ...defaultHandshake(), protocolVersion: 999 }, kind: 'incompatible' },
    { reply: { type: 'handshake-result' }, kind: 'malformed' },
  ])('immediately rejects a recognizable invalid handshake: $kind', async ({ reply, kind }) => {
    const host = createFakeHost({ handshake: () => reply });
    const unschedule = vi.fn(clearTimeout);
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: () => new ExtensionDocumentBridge({ ...host.bridgeOptions, unschedule }),
    });
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({ kind });
    expect(unschedule).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(host.portMessages)).not.toContain('top-secret');
  });

  it('uses a short default handshake deadline independently of operation deadlines', async () => {
    const host = createFakeHost();
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const bridge = new ExtensionDocumentBridge({
      ...host.bridgeOptions,
      handshakeTimeoutMs: undefined,
      pageDeadlineMs: 60_000,
    });
    await bridge.handshake();
    expect(schedule.mock.calls[0]?.[1]).toBe(2_000);
    await bridge.request({
      operation: 'getCurrentAccount',
      provider: 'openproject',
      baseUrl: config.baseUrl,
      secret: 'secret',
      payload: null,
    });
    expect(schedule.mock.calls[1]?.[1]).toBe(60_000);
    bridge.close();
    schedule.mockRestore();
  });

  it('ignores unrelated messages while waiting for a handshake', async () => {
    const channel = createLinkedChannel();
    const bridge = new ExtensionDocumentBridge({
      window: { location: { origin: 'https://app.example.com' }, postMessage() {} },
      createChannel: () => channel,
    });
    const result = bridge.handshake();
    channel.port2.postMessage({ type: 'unrelated', protocolVersion: 999 });
    channel.port2.postMessage(defaultHandshake());
    await expect(result).resolves.toEqual(defaultHandshake());
    bridge.close();
  });
  it.each([
    { ...defaultHandshake(), destinationApproved: undefined },
    { ...defaultHandshake(), destinationApproved: false },
    { ...defaultHandshake(), supportedOperations: ['searchIssues'] } satisfies HandshakeResult,
  ])('does not transmit credentials without approval and capability: %j', async (handshake) => {
    const host = createFakeHost({ handshake: () => handshake });
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      kind: handshake.destinationApproved === true ? 'incompatible' : 'permission',
    });
    expect(JSON.stringify(host.portMessages)).not.toContain('top-secret');
    expect(host.portMessages.at(-1)).toEqual({ type: 'osi-extension-disconnect' });
  });

  it('disposes each concurrent operation bridge and each availability probe', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: host.openBridge,
    });
    await Promise.all([adapter.getCurrentAccount(), adapter.searchIssues('login')]);
    await probeExtensionAvailability({ isClient: true, openBridge: host.openBridge });
    expect(host.connectMessages).toHaveLength(3);
    expect(
      host.portMessages.filter(
        (message) =>
          message instanceof Object &&
          'type' in message &&
          message.type === 'osi-extension-disconnect',
      ),
    ).toHaveLength(3);
  });

  it('handshakes without a secret, then runs all nine operations', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });

    expect(await adapter.searchIssues('login')).toEqual([issue]);
    expect(await adapter.searchIssues('login', { remoteProjectId: '3' })).toEqual([issue]);
    expect(await adapter.getIssueById('42')).toEqual(lookup);
    expect(await adapter.getIssueById('42', { remoteProjectId: '3' })).toEqual(lookup);
    expect(await adapter.listProjects()).toEqual([project]);
    expect(await adapter.getActivityOptions('42')).toEqual([activity]);
    expect(await adapter.getCurrentAccount()).toEqual(account);
    expect(await adapter.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] })).toEqual([
      log,
    ]);
    expect(await adapter.fetchTimeLogsInRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual([
      log,
    ]);
    expect(
      await adapter.createTimeEntry({
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      }),
    ).toEqual({ remoteLogId: '99' });
    expect(await adapter.deleteTimeEntry('99')).toEqual({ status: 'deleted' });

    const handshake = host.portMessages.find(
      (message) => handshakeRequestSchema.safeParse(message).success,
    );
    expect(handshake).toEqual({
      type: 'handshake',
      protocolVersion: EXTENSION_PROTOCOL_VERSION,
      destination: { provider: 'openproject', baseUrl: config.baseUrl },
    });
    expect(host.connectMessages[0]).toEqual({
      message: {
        channel: EXTENSION_CHANNEL,
        type: 'connect',
        protocolVersion: EXTENSION_PROTOCOL_VERSION,
      },
      origin: 'https://app.example.com',
    });
    const operations = host.portMessages.filter(
      (message) => operationRequestSchema.safeParse(message).success,
    );
    expect(operations).toHaveLength(11);
  });

  it('sends the query alone when unscoped and the scope alongside it when scoped', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });

    await adapter.searchIssues('login');
    await adapter.searchIssues('login', { remoteProjectId: '3' });
    await adapter.getIssueById('42');
    await adapter.getIssueById('42', { remoteProjectId: '3' });

    // SAFETY: the filter above keeps only messages that just parsed as OperationRequest.
    const operations = host.portMessages.filter(
      (message) => operationRequestSchema.safeParse(message).success,
    ) as OperationRequest[];
    expect(operations.map((op) => op.input)).toEqual([
      { query: 'login' },
      { query: 'login', scope: { remoteProjectId: '3' } },
      { remoteIssueId: '42' },
      { remoteIssueId: '42', scope: { remoteProjectId: '3' } },
    ]);
  });

  it('rejects listProjects as incompatible when the extension does not advertise it', async () => {
    const host = createFakeHost({
      handshake: () => ({
        ...defaultHandshake(),
        supportedOperations: EXTENSION_OPERATION_NAMES.filter((op) => op !== 'listProjects'),
      }),
    });
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });

    await expect(adapter.listProjects()).rejects.toMatchObject({ kind: 'incompatible' });
    expect(
      host.portMessages.some((message) => operationRequestSchema.safeParse(message).success),
    ).toBe(false);
  });

  it('exposes listProjects support through the availability probe handshake', async () => {
    const supported = createFakeHost();
    const withCatalog = await probeExtensionAvailability({
      isClient: true,
      openBridge: supported.openBridge,
    });
    expect(withCatalog.handshake?.supportedOperations).toContain('listProjects');

    const legacy = createFakeHost({
      handshake: () => ({
        ...defaultHandshake(),
        supportedOperations: EXTENSION_OPERATION_NAMES.filter((op) => op !== 'listProjects'),
      }),
    });
    const withoutCatalog = await probeExtensionAvailability({
      isClient: true,
      openBridge: legacy.openBridge,
    });
    expect(withoutCatalog.handshake?.supportedOperations).not.toContain('listProjects');
  });

  it('reconstructs upstream adapter errors without treating them as availability failures', async () => {
    const host = createFakeHost({
      operation: (message) => ({
        type: 'operation-result',
        requestId: message.requestId,
        operation: message.operation,
        ok: false,
        error: { kind: 'adapter', messageKey: 'error.remoteServerModeAuthRejected', status: 401 },
      }),
    });
    const adapter = new ExtensionExecutionAdapter(config, 'bad-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(adapter.searchIssues('login')).rejects.toMatchObject({
      name: 'RemoteAdapterError',
      messageKey: 'error.remoteServerModeAuthRejected',
      status: 401,
    });
    expect(host.portMessages.at(-1)).toEqual({ type: 'osi-extension-disconnect' });
  });

  it('does not post an operation when the secret is missing after handshake', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, null, {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(adapter.searchIssues('login')).rejects.toBeInstanceOf(RemoteAdapterError);
    expect(host.portMessages.at(-1)).toEqual({ type: 'osi-extension-disconnect' });
    expect(
      host.portMessages.some((message) => operationRequestSchema.safeParse(message).success),
    ).toBe(false);
  });

  it('does not execute on SSR and never falls back to a direct provider adapter', async () => {
    const openBridge = vi.fn();
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: false,
      openBridge,
    });
    await expect(adapter.searchIssues('login')).rejects.toBeInstanceOf(ExtensionProtocolError);
    expect(openBridge).not.toHaveBeenCalled();

    const factoryAdapter = createRemoteAdapter(config, 'secret');
    expect(factoryAdapter).toBeInstanceOf(ExtensionExecutionAdapter);
    expect(factoryAdapter).not.toBeInstanceOf(OpenProjectAdapter);
  });

  it('treats a lost create reply as unknown-create, not a retryable timeout', async () => {
    const host = createFakeHost({
      operation: () => undefined,
    });
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(
      adapter.createTimeEntry({
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      }),
    ).rejects.toMatchObject({
      kind: 'unknown-create',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate,
    });
    expect(host.portMessages.at(-1)).toEqual({ type: 'osi-extension-disconnect' });
  });

  it('returns typed delete outcomes and still throws guarded extension failures', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(adapter.deleteTimeEntry('99')).resolves.toEqual({ status: 'deleted' });

    const unavailable = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: false,
      openBridge: vi.fn(),
    });
    await expect(unavailable.deleteTimeEntry('99')).rejects.toBeInstanceOf(ExtensionProtocolError);
  });
});

describe('ExtensionExecutionAdapter admission gate (REQ-331)', () => {
  it('completes a page-load-sized burst without any operation seeing the extension limit error', async () => {
    const limit = EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument;
    const gate = new ExtensionOperationGate(limit);
    let activeBridges = 0;
    let maxActiveBridges = 0;
    const host = createFakeHost();
    const trackingOpenBridge: typeof host.openBridge = () => {
      activeBridges += 1;
      maxActiveBridges = Math.max(maxActiveBridges, activeBridges);
      const bridge = host.openBridge();
      const close = bridge.close.bind(bridge);
      bridge.close = () => {
        activeBridges -= 1;
        close();
      };
      return bridge;
    };

    // A Remote Sync day with more linked tasks than the extension's in-flight
    // cap, each resolving one activity fetch concurrently.
    const taskCount = limit + 2;
    const adapters = Array.from(
      { length: taskCount },
      () =>
        new ExtensionExecutionAdapter(config, 'secret', {
          isClient: true,
          openBridge: trackingOpenBridge,
          gate,
        }),
    );

    const results = await Promise.all(adapters.map((adapter) => adapter.getActivityOptions('42')));

    expect(results).toEqual(Array.from({ length: taskCount }, () => [activity]));
    expect(maxActiveBridges).toBeLessThanOrEqual(limit);
    expect(host.connectMessages).toHaveLength(taskCount);
  });

  it('queues an operation behind a full gate and dispatches it once a slot frees', async () => {
    const gate = new ExtensionOperationGate(1);
    const blockerResolvers: Array<() => void> = [];
    // Fill the single slot with a task the gate has no other visibility into,
    // proving the gate is a page-wide resource shared across call sites, not
    // just a per-adapter-instance counter.
    const blocker = gate.run(() => new Promise<void>((resolve) => blockerResolvers.push(resolve)));

    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: host.openBridge,
      gate,
    });
    const queued = adapter.getCurrentAccount();

    await flushMicrotasks();
    expect(host.connectMessages).toHaveLength(0);

    blockerResolvers[0]!();
    await blocker;

    await expect(queued).resolves.toEqual(account);
    expect(host.connectMessages).toHaveLength(1);
  });

  it('releases the slot after a rejection so the next queued operation still runs and reports its own result', async () => {
    const gate = new ExtensionOperationGate(1);
    const failingHost = createFakeHost({
      handshake: () => ({
        kind: 'incompatible',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible,
      }),
    });
    const failing = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: failingHost.openBridge,
      gate,
    });
    const succeedingHost = createFakeHost();
    const succeeding = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: succeedingHost.openBridge,
      gate,
    });

    const [failed, succeeded] = await Promise.allSettled([
      failing.getCurrentAccount(),
      succeeding.getCurrentAccount(),
    ]);

    expect(failed).toMatchObject({ status: 'rejected', reason: { kind: 'incompatible' } });
    expect(succeeded).toEqual({ status: 'fulfilled', value: account });
  });

  it('never dispatches a creation while it is only queued for a gate slot', async () => {
    const gate = new ExtensionOperationGate(1);
    const blockerResolvers: Array<() => void> = [];
    const blocker = gate.run(() => new Promise<void>((resolve) => blockerResolvers.push(resolve)));

    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'secret', {
      isClient: true,
      openBridge: host.openBridge,
      gate,
    });
    const queuedCreate = adapter.createTimeEntry({
      remoteIssueId: '42',
      spentOn: '2026-03-15',
      durationSeconds: 1800,
      activityId: '1',
    });

    await flushMicrotasks();
    // Still queued: no bridge opened, so nothing has been dispatched that
    // could later be mistaken for a lost create reply (REQ-312/unknown-create).
    expect(host.connectMessages).toHaveLength(0);
    expect(
      host.portMessages.some((message) => operationRequestSchema.safeParse(message).success),
    ).toBe(false);

    blockerResolvers[0]!();
    await blocker;

    await expect(queuedCreate).resolves.toEqual({ remoteLogId: '99' });
  });
});

describe('ExtensionDocumentBridge', () => {
  it('rejects a second handshake while one is already waiting', async () => {
    const channel = createLinkedChannel();
    const bridge = new ExtensionDocumentBridge({
      window: { location: { origin: 'https://app.example.com' }, postMessage() {} },
      createChannel: () => channel,
    });
    const first = bridge.handshake();
    await expect(bridge.handshake()).rejects.toMatchObject({
      kind: 'malformed',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.malformed,
    });
    bridge.close();
    await expect(first).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('rejects an in-flight create as unknown-create when closed', async () => {
    const host = createFakeHost({ operation: () => undefined });
    const bridge = host.openBridge();
    await bridge.handshake();
    const create = bridge.request({
      operation: 'createTimeEntry',
      provider: 'openproject',
      baseUrl: config.baseUrl,
      secret: 'secret',
      payload: {
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
      },
    });
    bridge.close();
    await expect(create).rejects.toMatchObject({
      kind: 'unknown-create',
      messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unknownCreate,
    });
  });
});
