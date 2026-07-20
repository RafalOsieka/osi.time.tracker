import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';
import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { normalizeBaseUrl } from '../../../shared/utils/normalize-base-url';

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

      try {
        const response = await $fetch.raw(request.url, {
          method: request.method,
          body: request.body as BodyInit | Record<string, unknown> | null | undefined,
          headers: {
            Accept: 'application/json',
            ...request.headers,
          },
        });
        return { status: response.status, payload: response._data };
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number; response?: { status?: number } })
          ?.statusCode;
        const status = statusCode ?? (err as { response?: { status?: number } })?.response?.status;
        if (status !== undefined) {
          throw { statusCode: status };
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
