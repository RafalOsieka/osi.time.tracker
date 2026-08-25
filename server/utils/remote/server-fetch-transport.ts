import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';
import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { normalizeBaseUrl } from '../../../shared/utils/normalize-base-url';
import type { JsonValue } from '../../../shared/types/json';
import { UpstreamHttpError } from '../../../shared/remote/upstream-http-error';

/**
 * `server` execution-mode transport (L4): forwards one request to the
 * caller's own configured tracker origin via `$fetch.raw`. Every request URL
 * (including followed pagination links) is checked against `allowedOrigin`;
 * a foreign origin is rejected without contacting it, so the server never
 * acts as an arbitrary-URL proxy. Auth headers are supplied by the provider
 * client on each request.
 */
export function createServerFetchTransport(baseUrl: string): Transport {
  const allowedOrigin = new URL(normalizeBaseUrl(baseUrl)).origin;

  return {
    async execute(request: RemoteRequest): Promise<RemoteResponse> {
      assertSameOrigin(request.url, allowedOrigin);

      const headers = new Headers({
        Accept: 'application/json',
        ...request.headers,
      });
      if (request.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }

      try {
        const response = await $fetch.raw(request.url, {
          method: request.method,
          body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
          headers,
        });
        const data = response._data;
        return {
          status: response.status,
          // SAFETY: $fetch.raw `_data` is untyped; provider clients parse named payloads.
          payload: data === undefined ? null : (data as JsonValue),
        };
      } catch (err) {
        if (err instanceof RemoteAdapterError) throw err;
        if (err instanceof Error && 'statusCode' in err) {
          const status = Number(err.statusCode);
          if (Number.isFinite(status)) {
            throw new UpstreamHttpError(status);
          }
        }
        throw err;
      }
    },
  };
}

function assertSameOrigin(targetUrl: string, allowedOrigin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new RemoteAdapterError('error.remoteServerModeOriginRejected', 400);
  }
  if (parsed.origin !== allowedOrigin) {
    throw new RemoteAdapterError('error.remoteServerModeOriginRejected', 400);
  }
}
