import type {
  RemoteRequest,
  RemoteResponse,
  Transport,
} from '../../../shared/types/remote-adapter';

/**
 * Builds the OpenProject Basic-auth token: username `apikey`, password the
 * browser-held secret, per OpenProject's REST API v3 convention.
 */
function encodeBasicAuth(secret: string): string {
  if (typeof btoa === 'function') {
    return btoa(`apikey:${secret}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node fallback (SSR/test) has no `btoa` global on older runtimes.
  return (globalThis as any).Buffer.from(`apikey:${secret}`, 'utf-8').toString('base64');
}

/**
 * `client` execution-mode transport (L4): queries the configured tracker
 * origin directly from the browser using the browser-held credential.
 * Never uses `$fetch`/`$csrfFetch`, so the OSI session/CSRF material never
 * leaks to a third-party origin.
 */
export const clientFetchTransport: Transport = {
  async execute(request: RemoteRequest): Promise<RemoteResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(request.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(request.secret ? { Authorization: `Basic ${encodeBasicAuth(request.secret)}` } : {}),
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
