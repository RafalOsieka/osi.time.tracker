import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ExtensionProtocolError } from '@osi/extension-protocol';
import { UpstreamHttpError, type JsonValue } from '@osi/remote-trackers/contracts';
import type { DestinationApproval } from '../../src/approvals/approvals.js';
import { CanonicalizationError } from '../../src/security/canonicalize.js';
import { createGuardedTransport } from '../../src/transport/guarded-transport.js';

const approval: DestinationApproval = {
  websiteOrigin: 'http://localhost:3000',
  provider: 'openproject',
  origin: 'https://op.example.com',
  basePath: '/openproject',
};

const payloadSchema = z.object({ ok: z.boolean() });

function jsonResponse(body: JsonValue, status = 200, extra?: Partial<Response>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
    ...extra,
  });
}

describe('guarded transport', () => {
  it('returns a normal JSON payload', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const transport = createGuardedTransport({ approval, fetchImpl });
    const result = await transport.execute(
      {
        url: 'https://op.example.com/openproject/api/v3/work_packages?q=a',
        method: 'GET',
        headers: { Authorization: 'Basic secret-token' },
      },
      payloadSchema,
    );
    expect(result).toEqual({ status: 200, payload: { ok: true } });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe('error');
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe('omit');
  });

  it('allows mounted base paths and rejects encoded traversal without fetching', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const transport = createGuardedTransport({ approval, fetchImpl });
    await expect(
      transport.execute(
        { url: 'https://op.example.com/openproject/api/v3', method: 'GET' },
        payloadSchema,
      ),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      transport.execute(
        { url: 'https://op.example.com/openproject/%2e%2e/secret', method: 'GET' },
        payloadSchema,
      ),
    ).rejects.toBeInstanceOf(CanonicalizationError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('does not fetch malicious response-derived URLs', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const transport = createGuardedTransport({ approval, fetchImpl });
    await expect(
      transport.execute(
        { url: 'https://evil.example.com/openproject/api/v3', method: 'GET' },
        payloadSchema,
      ),
    ).rejects.toBeInstanceOf(CanonicalizationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps auth rejection without including the secret in the error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'nope' }, 401));
    const transport = createGuardedTransport({ approval, fetchImpl });
    await expect(
      transport.execute(
        {
          url: 'https://op.example.com/openproject/api/v3/users/me',
          method: 'GET',
          headers: { Authorization: 'Basic super-secret' },
        },
        payloadSchema,
      ),
    ).rejects.toMatchObject({ name: 'UpstreamHttpError', statusCode: 401 });
  });

  it('maps unreachable hosts without leaking secrets', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED token=super-secret');
    });
    const transport = createGuardedTransport({ approval, fetchImpl });
    try {
      await transport.execute(
        {
          url: 'https://op.example.com/openproject/api/v3',
          method: 'GET',
          headers: { Authorization: 'Basic super-secret' },
        },
        payloadSchema,
      );
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamHttpError);
      expect(JSON.stringify(error)).not.toContain('super-secret');
    }
  });

  it('enforces response byte limits', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const transport = createGuardedTransport({
      approval,
      fetchImpl,
      maxResponseBytes: 2,
    });
    await expect(
      transport.execute(
        { url: 'https://op.example.com/openproject/api/v3', method: 'GET' },
        payloadSchema,
      ),
    ).rejects.toBeInstanceOf(ExtensionProtocolError);
  });
});
