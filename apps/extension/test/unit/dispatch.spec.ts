import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_PROTOCOL_VERSION, EXTENSION_RESOURCE_LIMITS } from '@osi/extension-protocol';
import type { JsonValue, RemoteTrackerAdapter } from '@osi/remote-trackers/contracts';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
} from '../../src/approvals/approvals.js';
import { handleHandshake, handleOperation, resetDispatchState } from '../../src/worker/dispatch.js';
import { isTrustedDocumentSender, type RuntimeSender } from '../../src/worker/sender.js';

const website = 'http://localhost:3000';
const openProject = 'https://op.example.com';
const redmine = 'https://rm.example.com';
const extensionId = 'osi-extension-id';
const secret = 'super-secret';

function trustedSender(documentId = 'doc-1'): RuntimeSender {
  return {
    id: extensionId,
    origin: website,
    url: `${website}/trackers`,
    frameId: 0,
    tabId: 1,
    documentId,
  };
}

async function approved() {
  const store = createMemoryApprovalStore();
  const permissions = createMemoryHostPermissions();
  const approvals = new ApprovalService(store, permissions);
  await approvals.approveWebsite(website);
  await approvals.approveDestination(website, 'openproject', openProject);
  await approvals.approveDestination(website, 'redmine', redmine);
  return approvals;
}

function probeAdapter(overrides: Partial<RemoteTrackerAdapter> = {}): RemoteTrackerAdapter {
  return {
    searchIssues: async () => [{ remoteIssueId: '1', title: 'Issue' }],
    getIssueById: async () => ({ remoteIssueId: '1', title: 'Issue' }),
    getActivityOptions: async () => [{ id: 'a', name: 'Dev' }],
    getCurrentAccount: async () => ({ id: 'u', name: 'Ada' }),
    fetchTimeLogs: async () => [
      {
        remoteLogId: 'l1',
        remoteIssueId: '1',
        spentOn: '2026-01-01',
        durationSeconds: 3600,
        activityId: 'a',
        activityName: 'Dev',
        comment: null,
        remoteUserId: 'u',
      },
    ],
    fetchTimeLogsInRange: async () => [],
    createTimeEntry: async () => ({ remoteLogId: 'log-1' }),
    ...overrides,
  };
}

function operationValue(
  operation: string,
  input: JsonValue,
  provider: 'openproject' | 'redmine' = 'openproject',
  requestId = 'req-1',
) {
  return {
    type: 'operation',
    requestId,
    operation,
    provider,
    baseUrl: provider === 'openproject' ? openProject : redmine,
    input,
    secret,
  };
}

afterEach(() => {
  resetDispatchState();
});

describe('worker dispatch', () => {
  it.each(['website', 'destination'] as const)(
    'aborts active fetch when options revoke a %s without removing a shared host grant',
    async (scope) => {
      const store = createMemoryApprovalStore();
      const permissions = createMemoryHostPermissions();
      const editor = new ApprovalService(store, permissions);
      const worker = new ApprovalService(store, permissions);
      await editor.approveWebsite(website);
      await editor.approveWebsite('http://localhost:3001');
      const approval = await editor.approveDestination(website, 'openproject', openProject);
      await editor.approveDestination('http://localhost:3001', 'openproject', openProject);
      const started = Promise.withResolvers<AbortSignal>();
      const fetchImpl = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) throw new Error('missing abort signal');
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            started.resolve(signal);
          }),
      );
      const pending = handleOperation({
        sender: trustedSender(),
        expectedExtensionId: extensionId,
        approvals: worker,
        fetchImpl,
        value: operationValue('getCurrentAccount', null),
      });
      const signal = await started.promise;
      if (scope === 'website') await editor.revokeWebsite(website);
      else await editor.revokeDestination(approval);
      expect(signal.aborted).toBe(true);
      expect(permissions.granted.has(`${openProject}/*`)).toBe(true);
      await expect(pending).resolves.toMatchObject({ ok: false });
      expect(fetchImpl).toHaveBeenCalledOnce();
    },
  );
  it('dispatches all seven operations through the shared adapter', async () => {
    const approvals = await approved();
    const seen: string[] = [];
    const adapter = probeAdapter({
      searchIssues: async (query) => {
        seen.push(`searchIssues:${query}`);
        return [{ remoteIssueId: '1', title: query }];
      },
      getIssueById: async (id) => {
        seen.push(`getIssueById:${id}`);
        return { remoteIssueId: id, title: 'Issue' };
      },
      getActivityOptions: async (id) => {
        seen.push(`getActivityOptions:${id}`);
        return [{ id: 'a', name: 'Dev' }];
      },
      getCurrentAccount: async () => {
        seen.push('getCurrentAccount');
        return { id: 'u', name: 'Ada' };
      },
      fetchTimeLogs: async (input) => {
        seen.push(`fetchTimeLogs:${input.spentOn}`);
        return [];
      },
      fetchTimeLogsInRange: async (input) => {
        seen.push(`fetchTimeLogsInRange:${input.from}:${input.to}`);
        return [];
      },
      createTimeEntry: async (input) => {
        seen.push(`createTimeEntry:${input.remoteIssueId}`);
        return { remoteLogId: 'log-1' };
      },
    });
    const createAdapter = vi.fn(() => adapter);
    const cases = [
      ['searchIssues', 'bug', { result: [{ remoteIssueId: '1', title: 'bug' }] }],
      ['getIssueById', '1', { result: { remoteIssueId: '1', title: 'Issue' } }],
      ['getActivityOptions', '1', { result: [{ id: 'a', name: 'Dev' }] }],
      ['getCurrentAccount', null, { result: { id: 'u', name: 'Ada' } }],
      ['fetchTimeLogs', { spentOn: '2026-01-01', workPackageIds: ['1'] }, { result: [] }],
      ['fetchTimeLogsInRange', { from: '2026-01-01', to: '2026-01-31' }, { result: [] }],
      [
        'createTimeEntry',
        {
          remoteIssueId: '1',
          spentOn: '2026-01-01',
          durationSeconds: 3600,
          activityId: 'a',
        },
        { result: { remoteLogId: 'log-1' } },
      ],
    ] as const;

    for (const [operation, input, expected] of cases) {
      const result = await handleOperation({
        sender: trustedSender(),
        expectedExtensionId: extensionId,
        approvals,
        createAdapter,
        value: operationValue(operation, input, 'openproject', `req-${operation}`),
      });
      expect(result).toMatchObject({ ok: true, operation, ...expected });
    }
    expect(seen).toEqual([
      'searchIssues:bug',
      'getIssueById:1',
      'getActivityOptions:1',
      'getCurrentAccount',
      'fetchTimeLogs:2026-01-01',
      'fetchTimeLogsInRange:2026-01-01:2026-01-31',
      'createTimeEntry:1',
    ]);
  });

  it('runs OpenProject and Redmine getCurrentAccount through shared providers', async () => {
    const approvals = await approved();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v3/users/me')) {
        return new Response(JSON.stringify({ id: 7, name: 'Ada' }), { status: 200 });
      }
      if (url.includes('/users/current.json')) {
        return new Response(
          JSON.stringify({ user: { id: 9, firstname: 'Ada', lastname: 'Lovelace' } }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });

    const openProjectResult = await handleOperation({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      fetchImpl,
      value: operationValue('getCurrentAccount', null, 'openproject'),
    });
    const redmineResult = await handleOperation({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      fetchImpl,
      value: operationValue('getCurrentAccount', null, 'redmine', 'req-2'),
    });
    expect(openProjectResult).toMatchObject({
      ok: true,
      result: { id: '7', name: 'Ada' },
    });
    expect(redmineResult).toMatchObject({
      ok: true,
      result: { id: '9', name: 'Ada Lovelace' },
    });
    expect(JSON.stringify(openProjectResult)).not.toContain(secret);
    expect(JSON.stringify(redmineResult)).not.toContain(secret);
  });

  it('rejects an unapproved sender origin without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}'));
    const approvals = await approved();
    const result = await handleOperation({
      sender: { ...trustedSender(), origin: 'https://evil.example', url: 'https://evil.example/' },
      expectedExtensionId: extensionId,
      approvals,
      fetchImpl,
      value: operationValue('getCurrentAccount', null),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'permission' },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects foreign extension and nested-frame senders', async () => {
    const approvals = await approved();
    const fetchImpl = vi.fn(async () => new Response('{}'));
    const foreign = await handleOperation({
      sender: { ...trustedSender(), id: 'other-extension' },
      expectedExtensionId: extensionId,
      approvals,
      fetchImpl,
      value: operationValue('getCurrentAccount', null),
    });
    const framed = await handleOperation({
      sender: { ...trustedSender(), frameId: 2 },
      expectedExtensionId: extensionId,
      approvals,
      fetchImpl,
      value: operationValue('getCurrentAccount', null, 'openproject', 'req-frame'),
    });
    expect(foreign).toMatchObject({ ok: false, error: { kind: 'permission' } });
    expect(framed).toMatchObject({ ok: false, error: { kind: 'permission' } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isTrustedDocumentSender(trustedSender(), extensionId, [website])).toBe(true);
    expect(
      isTrustedDocumentSender({ ...trustedSender(), frameId: 2 }, extensionId, [website]),
    ).toBe(false);
  });

  it('does not persist the operation secret on the approval store', async () => {
    const approvals = await approved();
    await handleOperation({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      createAdapter: () => probeAdapter(),
      value: operationValue('getCurrentAccount', null),
    });
    expect(JSON.stringify(await approvals.list())).not.toContain(secret);
  });

  it('enforces the per-document in-flight limit', async () => {
    const approvals = await approved();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter = probeAdapter({
      getCurrentAccount: async () => {
        await gate;
        return { id: 'u', name: 'Ada' };
      },
    });
    const pending = Array.from(
      { length: EXTENSION_RESOURCE_LIMITS.maxInFlightOperationsPerDocument },
      (_, index) =>
        handleOperation({
          sender: trustedSender(),
          expectedExtensionId: extensionId,
          approvals,
          createAdapter: () => adapter,
          value: operationValue('getCurrentAccount', null, 'openproject', `req-${index}`),
        }),
    );
    const limited = await handleOperation({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      createAdapter: () => adapter,
      value: operationValue('getCurrentAccount', null, 'openproject', 'req-limit'),
    });
    expect(limited).toMatchObject({ ok: false, error: { kind: 'limit' } });
    release();
    const settled = await Promise.all(pending);
    expect(settled.every((item) => 'ok' in item && item.ok)).toBe(true);
  });

  it('handshakes only for an approved website', async () => {
    const approvals = await approved();
    const ok = await handleHandshake({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      value: { type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION },
    });
    expect(ok).toMatchObject({ type: 'handshake-result', protocolVersion: 1 });
    const denied = await handleHandshake({
      sender: {
        ...trustedSender(),
        origin: 'https://other.example',
        url: 'https://other.example/',
      },
      expectedExtensionId: extensionId,
      approvals,
      value: { type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION },
    });
    expect(denied).toMatchObject({ kind: 'permission' });
  });

  it('does not automatically replay create after a worker restart', async () => {
    const approvals = await approved();
    const createTimeEntry = vi.fn(async () => {
      throw new Error('worker restarted');
    });
    const first = handleOperation({
      sender: trustedSender(),
      expectedExtensionId: extensionId,
      approvals,
      createAdapter: () => probeAdapter({ createTimeEntry }),
      value: operationValue('createTimeEntry', {
        remoteIssueId: '1',
        spentOn: '2026-01-01',
        durationSeconds: 3600,
        activityId: 'a',
      }),
    });
    resetDispatchState();
    await expect(first).resolves.toMatchObject({ ok: false });
    expect(createTimeEntry).toHaveBeenCalledOnce();
  });
});
