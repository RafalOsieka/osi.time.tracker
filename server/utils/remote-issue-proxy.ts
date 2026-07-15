import {
  buildIssueByIdRequest,
  buildTitleSearchRequest,
  parseIssueByIdResult,
  parseTitleSearchResults,
} from '../../shared/utils/openproject-adapter';
import type {
  RemoteIssueSearchMode,
  RemoteIssueSearchResult,
} from '../../shared/types/remote-issue-ref';
import type { ApiMessage } from '../types/api-message';

/**
 * Builds the OpenProject Basic-auth token: username `apikey`, password the
 * forwarded API key, per OpenProject's REST API v3 convention. Mirrors the
 * browser-side `encodeBasicAuth` in `useRemoteIssueSearch`.
 */
function encodeBasicAuth(secret: string): string {
  return Buffer.from(`apikey:${secret}`, 'utf-8').toString('base64');
}

/**
 * Forwards a title-search or exact issue-ID lookup to a resolved OpenProject
 * base URL, using the per-request forwarded secret, and maps the response
 * through the shared adapter into the adapter-neutral shape. Never logs or
 * echoes back `secret`. Failures are mapped to distinct translated
 * `{ messageKey, params }` errors (auth rejected / connection failure /
 * not-found) rather than leaking the raw upstream status or body.
 */
export async function proxyOpenProjectSearch(
  baseUrl: string,
  secret: string,
  mode: RemoteIssueSearchMode,
  query: string,
): Promise<RemoteIssueSearchResult[]> {
  const request =
    mode === 'title'
      ? buildTitleSearchRequest(baseUrl, query)
      : buildIssueByIdRequest(baseUrl, query);

  try {
    const payload = await $fetch.raw(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodeBasicAuth(secret)}`,
      },
    });

    if (mode === 'id') {
      const result = parseIssueByIdResult(payload._data, payload.status);
      return result ? [result] : [];
    }

    return parseTitleSearchResults(payload._data);
  } catch (err: unknown) {
    throw mapUpstreamError(err, mode);
  }
}

function mapUpstreamError(
  err: unknown,
  mode: RemoteIssueSearchMode,
): ReturnType<typeof createError> {
  const status =
    (err as { statusCode?: number; response?: { status?: number } })?.statusCode ??
    (err as { response?: { status?: number } })?.response?.status;

  if (status === 404 && mode === 'id') {
    return createError({
      statusCode: 404,
      data: { messageKey: 'error.remoteIssueSearchNotFound' } satisfies ApiMessage,
    });
  }

  if (status === 401 || status === 403) {
    return createError({
      statusCode: 502,
      data: { messageKey: 'error.remoteProxyAuthRejected' } satisfies ApiMessage,
    });
  }

  if (status !== undefined) {
    return createError({
      statusCode: 502,
      data: { messageKey: 'error.remoteIssueSearchFailed' } satisfies ApiMessage,
    });
  }

  // No HTTP status at all: connection refused, timeout, or DNS failure.
  return createError({
    statusCode: 502,
    data: { messageKey: 'error.remoteProxyConnectionFailed' } satisfies ApiMessage,
  });
}
