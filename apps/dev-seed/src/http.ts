import type { ZodType } from 'zod';
import type { JsonValue } from '@osi/remote-trackers/contracts';
import type { FetchLike, TransportDiagnostics } from './transport.js';

export type JsonMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A request the adapters do not cover (projects, issues, statuses): the
 * seed's own admin-level calls. `PUT`/`PATCH` are why this exists next to
 * the `Transport`.
 */
export interface JsonHttp {
  request<T>(
    method: JsonMethod,
    url: string,
    schema: ZodType<T>,
    body?: JsonValue,
  ): Promise<{
    status: number;
    payload: T | null;
  }>;
}

export class SeedHttpError extends Error {
  constructor(
    readonly method: JsonMethod,
    readonly url: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${method} ${url} -> HTTP ${status}${body ? `: ${body.slice(0, 500)}` : ''}`);
    this.name = 'SeedHttpError';
  }
}

/**
 * JSON over `fetch` with fixed auth headers. Throws `SeedHttpError` on any
 * non-2xx status except 404 (returned as `{ status: 404, payload: null }`
 * so callers can treat "gone" as a state).
 */
export function createJsonHttp(
  fetchFn: FetchLike,
  authHeaders: Record<string, string>,
  diagnostics: TransportDiagnostics = { lastErrorBody: null },
): JsonHttp {
  return {
    async request(method, url, schema, body) {
      const encoded = body === undefined ? undefined : JSON.stringify(body);
      const baseHeaders = { Accept: 'application/json', ...authHeaders };
      const headers =
        encoded === undefined
          ? baseHeaders
          : { ...baseHeaders, 'Content-Type': 'application/json' };
      const response = await fetchFn(url, { method, headers, body: encoded });
      const text = await response.text();
      if (response.status === 404) return { status: 404, payload: null };
      if (!response.ok) {
        diagnostics.lastErrorBody = text;
        throw new SeedHttpError(method, url, response.status, text);
      }
      if (text.trim() === '') return { status: response.status, payload: null };
      const parsed = schema.safeParse(JSON.parse(text));
      return { status: response.status, payload: parsed.success ? parsed.data : null };
    },
  };
}
