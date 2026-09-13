import type { ZodType } from 'zod';
import type { RemoteRequest, RemoteResponse, Transport } from '@osi/remote-trackers/contracts';
import { UpstreamHttpError } from '@osi/remote-trackers/contracts';

/** The slice of `fetch` the transport needs; tests pass a fake, the CLI passes `fetch`. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

/** Body text of the most recent non-2xx response, for the CLI's failure report. */
export interface TransportDiagnostics {
  lastErrorBody: string | null;
}

/**
 * A plain Node `fetch` `Transport` for `@osi/remote-trackers`: forwards the
 * provider-built headers untouched, sends JSON bodies, and mirrors the
 * extension transport's response contract (throw on non-2xx except 403/404,
 * `payload` is the schema-parsed body or `null`).
 */
export function createFetchTransport(
  fetchFn: FetchLike,
  diagnostics: TransportDiagnostics = { lastErrorBody: null },
): Transport {
  return {
    async execute<T>(request: RemoteRequest, schema: ZodType<T>): Promise<RemoteResponse<T>> {
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const baseHeaders = { Accept: 'application/json', ...request.headers };
      const headers =
        body === undefined ? baseHeaders : { ...baseHeaders, 'Content-Type': 'application/json' };

      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await fetchFn(request.url, { method: request.method, headers, body });
      } catch {
        throw new UpstreamHttpError(0);
      }
      const text = await response.text();
      if (!response.ok) diagnostics.lastErrorBody = text;
      if (!response.ok && response.status !== 403 && response.status !== 404) {
        throw new UpstreamHttpError(response.status);
      }
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        return { status: response.status, payload: parsed.success ? parsed.data : null };
      } catch {
        return { status: response.status, payload: null };
      }
    },
  };
}
