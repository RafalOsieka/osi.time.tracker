import type { ZodType } from 'zod';
import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';
import { UpstreamHttpError } from '~~/shared/remote/upstream-http-error';

/**
 * `client` execution-mode transport (L4): queries the configured tracker
 * origin directly from the browser using the browser-held credential.
 * Never uses `$fetch`/`$csrfFetch`, so the OSI session/CSRF material never
 * leaks to a third-party origin. Auth headers are supplied by the provider
 * client on each request.
 */
export const clientFetchTransport: Transport = {
  async execute<T>(request: RemoteRequest, schema: ZodType<T>): Promise<RemoteResponse<T>> {
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

    try {
      const parsed = schema.safeParse(await response.json());
      return { status: response.status, payload: parsed.success ? parsed.data : null };
    } catch {
      return { status: response.status, payload: null };
    }
  },
};
