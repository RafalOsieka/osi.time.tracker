import { describe, expect, it, vi } from 'vitest';
import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_PROTOCOL_VERSION,
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
import { OpenProjectAdapter } from '@osi/remote-trackers/openproject';
import { ServerExecutionAdapter } from '../../app/utils/remote/server-execution-adapter';
import type { TrackerDto } from '../../shared/types/tracker';

const config: TrackerDto = {
  id: 'config-1',
  name: 'OpenProject',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'extension',
  roundingRule: 'none',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const issue = { remoteIssueId: '42', title: 'Fix login' };
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
        result: issue,
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
      status: 'permission',
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

  it('handshakes without a secret, then runs all seven operations', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, 'top-secret', {
      isClient: true,
      openBridge: host.openBridge,
    });

    expect(await adapter.searchIssues('login')).toEqual([issue]);
    expect(await adapter.getIssueById('42')).toEqual(issue);
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
    expect(operations).toHaveLength(7);
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

  it('does not execute on SSR and never falls back to client or server adapters', async () => {
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
    expect(factoryAdapter).not.toBeInstanceOf(ServerExecutionAdapter);
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
