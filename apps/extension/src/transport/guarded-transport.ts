import {
  EXTENSION_RESOURCE_LIMITS,
  ExtensionProtocolError,
  EXTENSION_ERROR_MESSAGE_KEYS,
} from '@osi/extension-protocol';
import {
  UpstreamHttpError,
  type RemoteRequest,
  type RemoteResponse,
  type Transport,
} from '@osi/remote-trackers/contracts';
import type { ZodType } from 'zod';
import { destinationAllowsUrl, type DestinationApproval } from '../approvals/approvals.js';
import { CanonicalizationError, canonicalizeRequestUrl } from '../security/canonicalize.js';

const ALLOWED_HEADERS = new Set(['accept', 'content-type', 'authorization', 'x-redmine-api-key']);

export interface GuardedTransportOptions {
  approval: DestinationApproval;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  maxNetworkCalls?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
}

function assertAllowedHeaders(headers: Record<string, string> | undefined): void {
  if (!headers) return;
  for (const name of Object.keys(headers)) {
    if (!ALLOWED_HEADERS.has(name.toLowerCase())) {
      throw new CanonicalizationError('error.extensionDestinationUnapproved');
    }
  }
}

function mergeSignals(left?: AbortSignal, right?: AbortSignal): AbortSignal | undefined {
  if (!left) return right;
  if (!right) return left;
  return AbortSignal.any([left, right]);
}

/** Transport that refuses unapproved destinations, redirects, and oversized bodies. */
export function createGuardedTransport(options: GuardedTransportOptions): Transport {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxNetworkCalls =
    options.maxNetworkCalls ?? EXTENSION_RESOURCE_LIMITS.maxNetworkCallsPerOperation;
  const maxResponseBytes =
    options.maxResponseBytes ?? EXTENSION_RESOURCE_LIMITS.maxResponseEnvelopeBytes;
  const timeoutMs = options.timeoutMs ?? EXTENSION_RESOURCE_LIMITS.networkRequestTimeoutMs;
  let networkCalls = 0;

  return {
    async execute<T>(request: RemoteRequest, schema: ZodType<T>): Promise<RemoteResponse<T>> {
      if (request.method !== 'GET' && request.method !== 'POST') {
        throw new CanonicalizationError('error.extensionDestinationUnapproved');
      }
      const canonical = canonicalizeRequestUrl(request.url);
      if (!destinationAllowsUrl(options.approval, canonical)) {
        throw new CanonicalizationError('error.extensionDestinationUnapproved');
      }
      assertAllowedHeaders(request.headers);
      networkCalls += 1;
      if (networkCalls > maxNetworkCalls) {
        throw new ExtensionProtocolError('limit', EXTENSION_ERROR_MESSAGE_KEYS.limit);
      }

      const headers = new Headers({ Accept: 'application/json', ...request.headers });
      if (request.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }

      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = mergeSignals(options.signal, timeout);
      let response: Response;
      try {
        response = await fetchImpl(request.url, {
          method: request.method,
          headers,
          body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
          redirect: 'error',
          credentials: 'omit',
          signal,
        });
      } catch {
        throw new UpstreamHttpError(0);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > maxResponseBytes) {
        throw new ExtensionProtocolError('limit', EXTENSION_ERROR_MESSAGE_KEYS.limit);
      }

      if (!response.ok && response.status !== 403 && response.status !== 404) {
        throw new UpstreamHttpError(response.status);
      }

      try {
        const text = new TextDecoder().decode(bytes);
        const parsed = schema.safeParse(JSON.parse(text));
        return { status: response.status, payload: parsed.success ? parsed.data : null };
      } catch {
        return { status: response.status, payload: null };
      }
    },
  };
}
