import { describe, expect, it, vi } from 'vitest';
import {
  EXTENSION_CHANNEL,
  EXTENSION_ERROR_MESSAGE_KEYS,
  EXTENSION_OPERATION_NAMES,
  EXTENSION_PROTOCOL_VERSION,
  ExtensionProtocolError,
} from '@osi/extension-protocol';
import { RemoteAdapterError } from '@osi/remote-trackers/contracts';
import { createRemoteAdapter } from '../../app/utils/remote/create-remote-adapter';
import { probeExtensionAvailability } from '../../app/utils/remote/extension-availability';
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
  const port1Listeners = new Set<(event: { data: unknown }) => void>();
  const port2Listeners = new Set<(event: { data: unknown }) => void>();

  function createPort(
    own: Set<(event: { data: unknown }) => void>,
    peer: Set<(event: { data: unknown }) => void>,
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

function operationSuccess(request: { requestId: string; operation: string }): {
  type: 'operation-result';
  requestId: string;
  operation: string;
  ok: true;
  result: unknown;
} {
  switch (request.operation) {
    case 'searchIssues':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: [issue],
      };
    case 'getIssueById':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: issue,
      };
    case 'getActivityOptions':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: [activity],
      };
    case 'getCurrentAccount':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: account,
      };
    case 'fetchTimeLogs':
    case 'fetchTimeLogsInRange':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: [log],
      };
    case 'createTimeEntry':
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: { remoteLogId: '99' },
      };
    default:
      return {
        type: 'operation-result',
        requestId: request.requestId,
        operation: request.operation,
        ok: true,
        result: null,
      };
  }
}

function createFakeHost(options?: {
  handshake?: (message: Record<string, unknown>) => unknown;
  operation?: (message: Record<string, unknown>) => unknown | undefined;
}) {
  const connectMessages: unknown[] = [];
  const portMessages: unknown[] = [];
  const windowRef: ExtensionWindow = {
    location: { origin: 'https://app.example.com' },
    postMessage(message, origin, transfer) {
      connectMessages.push({ message, origin });
      const pagePort = transfer?.[0] as ExtensionMessagePort | undefined;
      pagePort?.addEventListener('message', (event) => {
        const data = event.data;
        portMessages.push(data);
        if (!(data instanceof Object)) return;
        const record = data as Record<string, unknown>;
        if (record.type === 'handshake') {
          pagePort.postMessage(options?.handshake ? options.handshake(record) : defaultHandshake());
          return;
        }
        if (
          record.type === 'operation' &&
          typeof record.requestId === 'string' &&
          typeof record.operation === 'string'
        ) {
          const reply = options?.operation
            ? options.operation(record)
            : operationSuccess({ requestId: record.requestId, operation: record.operation });
          if (reply !== undefined) pagePort.postMessage(reply);
        }
      });
    },
  };

  let requestSeq = 0;
  const bridgeOptions: Partial<ExtensionBridgeOptions> = {
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
    openBridge: () => new ExtensionDocumentBridge(bridgeOptions as ExtensionBridgeOptions),
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

  it('treats an unapproved destination as permission-required', async () => {
    const host = createFakeHost({
      handshake: () => ({ ...defaultHandshake(), destinationApproved: false }),
    });
    const result = await probeExtensionAvailability({
      isClient: true,
      openBridge: host.openBridge,
      destination: { provider: 'openproject', baseUrl: config.baseUrl },
    });
    expect(result.status).toBe('permission');
    expect(result.messageKey).toBe(EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved);
  });
});

describe('ExtensionExecutionAdapter', () => {
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
      (message) => message instanceof Object && (message as { type?: string }).type === 'handshake',
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
      (message) => message instanceof Object && (message as { type?: string }).type === 'operation',
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
  });

  it('does not post an operation when the secret is missing after handshake', async () => {
    const host = createFakeHost();
    const adapter = new ExtensionExecutionAdapter(config, null, {
      isClient: true,
      openBridge: host.openBridge,
    });
    await expect(adapter.searchIssues('login')).rejects.toBeInstanceOf(RemoteAdapterError);
    expect(
      host.portMessages.some(
        (message) =>
          message instanceof Object && (message as { type?: string }).type === 'operation',
      ),
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
  });
});
