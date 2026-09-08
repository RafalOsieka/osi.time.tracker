import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTENSION_PROTOCOL_VERSION } from '@osi/extension-protocol';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
} from '../../src/approvals/approvals.js';
import { handleHandshake, handleOperation, resetDispatchState } from '../../src/worker/dispatch.js';
import { isTrustedDocumentSender } from '../../src/worker/sender.js';

const website = 'http://localhost:3000';
const tracker = 'https://op.example.com';

async function approved() {
  const store = createMemoryApprovalStore();
  const permissions = createMemoryHostPermissions();
  const approvals = new ApprovalService(store, permissions);
  await approvals.approveWebsite(website);
  await approvals.approveDestination(website, 'openproject', tracker);
  return approvals;
}

afterEach(() => {
  resetDispatchState();
});

describe('worker dispatch', () => {
  it('rejects an unapproved sender origin without calling fetch', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}'));
    const approvals = await approved();
    const result = await handleOperation({
      senderOrigin: 'https://evil.example',
      approvals,
      fetchImpl,
      value: {
        type: 'operation',
        requestId: 'req-1',
        operation: 'getCurrentAccount',
        provider: 'openproject',
        baseUrl: tracker,
        input: null,
        secret: 'super-secret',
      },
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'permission' },
    });
    expect(JSON.stringify(result)).not.toContain('super-secret');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handshakes only for an approved website', async () => {
    const approvals = await approved();
    const ok = await handleHandshake(
      website,
      { type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION },
      approvals,
    );
    expect(ok).toMatchObject({ type: 'handshake-result', protocolVersion: 1 });
    const denied = await handleHandshake(
      'https://other.example',
      { type: 'handshake', protocolVersion: EXTENSION_PROTOCOL_VERSION },
      approvals,
    );
    expect(denied).toMatchObject({ kind: 'permission' });
  });

  it('rejects nested-frame senders', () => {
    expect(isTrustedDocumentSender({ origin: website, frameId: 2 }, [website])).toBe(false);
    expect(isTrustedDocumentSender({ origin: website, frameId: 0 }, [website])).toBe(true);
  });
});
