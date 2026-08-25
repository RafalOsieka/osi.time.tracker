import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';
import type { JsonValue } from '../../../shared/types/json';
import { UpstreamHttpError } from '../../../shared/remote/upstream-http-error';

/**
 * `client` execution-mode transport (L4): queries the configured tracker
 * origin directly from the browser using the browser-held credential.
 * Never uses `$fetch`/`$csrfFetch`, so the OSI session/CSRF material never
 * leaks to a third-party origin. Auth headers are supplied by the provider
 * client on each request.
 */
export const clientFetchTransport: Transport = {
  async execute(request: RemoteRequest): Promise<RemoteResponse> {
    const headers = new Headers({
      Accept: 'application/json',
      ...request.headers,
    });
    if (request.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
    });

    if (!response.ok && response.status !== 403 && response.status !== 404) {
      throw new UpstreamHttpError(response.status);
    }

    const payload = await safeJson(response);
    return { status: response.status, payload };
  },
};

async function safeJson(response: Response): Promise<JsonValue | null> {
  try {
    // SAFETY: fetch JSON is untyped at the platform boundary; provider clients parse named payloads.
    return (await response.json()) as JsonValue;
  } catch {
    return null;
  }
}
