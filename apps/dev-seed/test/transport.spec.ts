import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { UpstreamHttpError } from '@osi/remote-trackers/contracts';
import {
  createFetchTransport,
  type FetchLike,
  type TransportDiagnostics,
} from '../src/transport.js';

interface Call {
  url: string;
  init: Parameters<FetchLike>[1];
}

function fakeFetch(status: number, body: string, calls: Call[]): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
}

const schema = z.object({ id: z.number() });

describe('createFetchTransport', () => {
  it('forwards provider headers as-is, adds Accept, and JSON-encodes bodies', async () => {
    const calls: Call[] = [];
    const transport = createFetchTransport(fakeFetch(200, '{"id":1}', calls));
    const response = await transport.execute(
      {
        url: 'http://tracker/x',
        method: 'POST',
        headers: { 'X-Redmine-API-Key': 'k' },
        body: { a: 1 },
      },
      schema,
    );
    expect(response).toEqual({ status: 200, payload: { id: 1 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Redmine-API-Key': 'k',
    });
    expect(calls[0]?.init.body).toBe('{"a":1}');
  });

  it('never adds credentials on its own and sends no body for GET', async () => {
    const calls: Call[] = [];
    const transport = createFetchTransport(fakeFetch(200, '{"id":2}', calls));
    await transport.execute({ url: 'http://tracker/y', method: 'GET' }, schema);
    expect(calls[0]?.init.headers).toEqual({ Accept: 'application/json' });
    expect(calls[0]?.init.body).toBeUndefined();
  });

  it('returns a null payload for non-JSON or schema-mismatching bodies', async () => {
    const plain = createFetchTransport(fakeFetch(200, 'not json', []));
    expect(await plain.execute({ url: 'u', method: 'GET' }, schema)).toEqual({
      status: 200,
      payload: null,
    });
    const mismatch = createFetchTransport(fakeFetch(200, '{"id":"x"}', []));
    expect(await mismatch.execute({ url: 'u', method: 'GET' }, schema)).toEqual({
      status: 200,
      payload: null,
    });
  });

  it('passes 403/404 through and throws UpstreamHttpError for other failures', async () => {
    const notFound = createFetchTransport(fakeFetch(404, '', []));
    expect(await notFound.execute({ url: 'u', method: 'GET' }, schema)).toEqual({
      status: 404,
      payload: null,
    });
    const diagnostics: TransportDiagnostics = { lastErrorBody: null };
    const failing = createFetchTransport(fakeFetch(422, '{"errors":["bad"]}', []), diagnostics);
    await expect(failing.execute({ url: 'u', method: 'POST' }, schema)).rejects.toBeInstanceOf(
      UpstreamHttpError,
    );
    expect(diagnostics.lastErrorBody).toBe('{"errors":["bad"]}');
  });

  it('maps a network failure to UpstreamHttpError(0)', async () => {
    const transport = createFetchTransport(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(transport.execute({ url: 'u', method: 'GET' }, schema)).rejects.toMatchObject({
      statusCode: 0,
    });
  });
});
