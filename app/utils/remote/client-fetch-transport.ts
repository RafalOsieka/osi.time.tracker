import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';

/**
 * `client` execution-mode transport (L4): queries the configured tracker
 * origin directly from the browser using the browser-held credential.
 * Never uses `$fetch`/`$csrfFetch`, so the OSI session/CSRF material never
 * leaks to a third-party origin. Auth headers are supplied by the provider
 * client on each request.
 */
export const clientFetchTransport: Transport = {
  async execute(request: RemoteRequest): Promise<RemoteResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(request.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...request.headers,
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
    });

    if (!response.ok && response.status !== 403 && response.status !== 404) {
      throw { statusCode: response.status };
    }

    const payload = await safeJson(response);
    return { status: response.status, payload };
  },
};

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
