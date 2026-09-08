import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ExtensionProtocolError } from '@osi/extension-protocol';
import { UpstreamHttpError, type JsonValue } from '@osi/remote-trackers/contracts';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
  hostMatchPattern,
  type DestinationApproval,
} from '../../src/approvals/approvals.js';
import { CanonicalizationError } from '../../src/security/canonicalize.js';
import { createGuardedTransport } from '../../src/transport/guarded-transport.js';

const approval: DestinationApproval = {
  websiteOrigin: 'http://localhost:3000',
  provider: 'openproject',
  origin: 'https://op.example.com',
  basePath: '/openproject',
};

const payloadSchema = z.object({ ok: z.boolean() });

function authorizedTransport(
  options: Omit<Parameters<typeof createGuardedTransport>[0], 'approvals'>,
) {
  const approvals = new ApprovalService(
    createMemoryApprovalStore({
      websites: [{ origin: approval.websiteOrigin }],
      destinations: [approval],
    }),
    createMemoryHostPermissions(
      new Set([hostMatchPattern(approval.origin), hostMatchPattern(approval.websiteOrigin)]),
    ),
  );
  return createGuardedTransport({ approvals, ...options });
}

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
    const transport = authorizedTransport({ approval, fetchImpl });
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
    const transport = authorizedTransport({ approval, fetchImpl });
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
    const transport = authorizedTransport({ approval, fetchImpl });
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
    const transport = authorizedTransport({ approval, fetchImpl });
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
    const transport = authorizedTransport({ approval, fetchImpl });
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
    const transport = authorizedTransport({
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

  it.each(['website', 'destination', 'host'] as const)(
    'rechecks %s authorization before every network step',
    async (scope) => {
      const store = createMemoryApprovalStore({
        websites: [{ origin: approval.websiteOrigin }],
        destinations: [approval],
      });
      const permissions = createMemoryHostPermissions(
        new Set([hostMatchPattern(approval.origin), hostMatchPattern(approval.websiteOrigin)]),
      );
      const approvals = new ApprovalService(store, permissions);
      const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
      const transport = createGuardedTransport({ approval, approvals, fetchImpl });
      const request = {
        url: `${approval.origin}${approval.basePath}/api/v3`,
        method: 'GET' as const,
      };
      await transport.execute(request, payloadSchema);
      if (scope === 'host') permissions.granted.delete(hostMatchPattern(approval.origin));
      else
        await store.save({
          websites: scope === 'website' ? [] : [{ origin: approval.websiteOrigin }],
          destinations: scope === 'destination' ? [] : [approval],
        });
      await expect(transport.execute(request, payloadSchema)).rejects.toBeInstanceOf(
        CanonicalizationError,
      );
      expect(fetchImpl).toHaveBeenCalledOnce();
    },
  );

  it('cancels an oversized stream before reading the rest, regardless of content-length', async () => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(3));
          if (reads === 10) controller.close();
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const transport = authorizedTransport({
      approval,
      fetchImpl: async () => new Response(body, { headers: { 'content-length': '1' } }),
      maxResponseBytes: 4,
    });
    await expect(
      transport.execute(
        { url: `${approval.origin}${approval.basePath}/api/v3`, method: 'GET' },
        payloadSchema,
      ),
    ).rejects.toBeInstanceOf(ExtensionProtocolError);
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels a stalled response body on operation abort', async () => {
    const controller = new AbortController();
    const reading = Promise.withResolvers<undefined>();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          reading.resolve(undefined);
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const transport = authorizedTransport({
      approval,
      signal: controller.signal,
      fetchImpl: async () => new Response(body),
    });
    const result = transport.execute(
      { url: `${approval.origin}${approval.basePath}/api/v3`, method: 'GET' },
      payloadSchema,
    );
    const rejected = expect(result).rejects.toThrow();
    await reading.promise;
    controller.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('decodes split UTF-8 at the exact byte limit', async () => {
    const bytes = new TextEncoder().encode('{"text":"ż"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const transport = authorizedTransport({
      approval,
      maxResponseBytes: bytes.length,
      fetchImpl: async () => new Response(body),
    });
    await expect(
      transport.execute(
        { url: `${approval.origin}${approval.basePath}/api/v3`, method: 'GET' },
        z.object({ text: z.string() }),
      ),
    ).resolves.toEqual({ status: 200, payload: { text: 'ż' } });
  });
});
