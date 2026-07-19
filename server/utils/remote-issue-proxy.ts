import {
  buildCreateTimeEntryRequest,
  buildCurrentAccountRequest,
  buildIssueByIdRequest,
  buildTimeEntryActivitiesRequest,
  buildTimeLogsRequest,
  buildTitleSearchRequest,
  parseCreateTimeEntryResult,
  parseCurrentAccountResult,
  parseIssueByIdResult,
  parseTimeEntryActivitiesResults,
  parseTimeLogsPage,
  parseTitleSearchResults,
  type AdapterFieldOption,
  type OpenProjectAccount,
} from '../../shared/utils/openproject-adapter';
import type {
  RemoteIssueSearchMode,
  RemoteIssueSearchResult,
} from '../../shared/types/remote-issue-ref';
import type { RemoteTimeLogDto } from '../../shared/types/remote-export';
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
    throw mapUpstreamError(err, {
      mode,
      failureMessageKey: 'error.remoteIssueSearchFailed',
    });
  }
}

/**
 * Forwards a project-scoped time-entry activities options request, keyed by
 * the given work-package `remoteIssueId`, to a resolved OpenProject base
 * URL, using the per-request forwarded secret, and maps the response
 * through the shared adapter into adapter-neutral options. Never logs or
 * echoes back `secret`. A `403` is treated as an empty result rather than a
 * hard failure: OpenProject returns it for work packages whose type doesn't
 * allow time logging (e.g. a "Summary" item), which is a per-work-package
 * permission outcome, not a rejected credential.
 */
export async function proxyOpenProjectActivities(
  baseUrl: string,
  secret: string,
  remoteIssueId: string,
): Promise<AdapterFieldOption[]> {
  const request = buildTimeEntryActivitiesRequest(baseUrl, remoteIssueId);

  try {
    const payload = await $fetch.raw(request.url, {
      method: request.method,
      body: request.body as BodyInit | Record<string, unknown> | null | undefined,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodeBasicAuth(secret)}`,
      },
    });

    return parseTimeEntryActivitiesResults(payload._data);
  } catch (err: unknown) {
    if (getUpstreamStatus(err) === 403) {
      return [];
    }
    throw mapUpstreamError(err, {
      failureMessageKey: 'error.remoteActivitiesFetchFailed',
    });
  }
}

/**
 * Resolves the authenticated OpenProject account for the configured origin.
 */
export async function proxyOpenProjectCurrentAccount(
  baseUrl: string,
  secret: string,
): Promise<OpenProjectAccount> {
  const request = buildCurrentAccountRequest(baseUrl);
  try {
    const payload = await $fetch.raw(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodeBasicAuth(secret)}`,
      },
    });
    const account = parseCurrentAccountResult(payload._data);
    if (!account) {
      throw createError({
        statusCode: 502,
        data: { messageKey: 'error.remoteAccountFetchFailed' } satisfies ApiMessage,
      });
    }
    return account;
  } catch (err: unknown) {
    if ((err as { statusCode?: number })?.statusCode === 502) throw err;
    throw mapUpstreamError(err, {
      failureMessageKey: 'error.remoteAccountFetchFailed',
    });
  }
}

/**
 * Fetches all pages of same-day current-account time logs for the given work
 * packages. Destination URLs are always derived from `baseUrl`; absolute
 * next-page links must stay on the same origin.
 */
export async function proxyOpenProjectTimeLogs(
  baseUrl: string,
  secret: string,
  input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  },
): Promise<RemoteTimeLogDto[]> {
  const allowedOrigin = new URL(normalizeProxyBase(baseUrl)).origin;
  const logs: RemoteTimeLogDto[] = [];
  let nextPageUrl: string | undefined;

  for (let page = 0; page < 50; page += 1) {
    const request = buildTimeLogsRequest({
      baseUrl,
      spentOn: input.spentOn,
      workPackageIds: input.workPackageIds,
      userId: input.userId,
      nextPageUrl,
    });
    assertSameOrigin(request.url, allowedOrigin);

    try {
      const payload = await $fetch.raw(request.url, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${encodeBasicAuth(secret)}`,
        },
      });
      const parsed = parseTimeLogsPage(payload._data);
      logs.push(...parsed.logs);
      if (!parsed.nextPageUrl) break;
      nextPageUrl = parsed.nextPageUrl;
    } catch (err: unknown) {
      throw mapUpstreamError(err, {
        failureMessageKey: 'error.remoteTimeLogsFetchFailed',
      });
    }
  }

  return logs;
}

/**
 * Creates one OpenProject time entry and returns the remote log id.
 */
export async function proxyOpenProjectCreateTimeEntry(
  baseUrl: string,
  secret: string,
  input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  },
): Promise<{ remoteLogId: string }> {
  const request = buildCreateTimeEntryRequest({
    baseUrl,
    remoteIssueId: input.remoteIssueId,
    spentOn: input.spentOn,
    durationSeconds: input.durationSeconds,
    activityId: input.activityId,
    comment: input.comment,
  });

  try {
    const payload = await $fetch.raw(request.url, {
      method: request.method,
      body: request.body as BodyInit | Record<string, unknown> | null | undefined,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${encodeBasicAuth(secret)}`,
      },
    });
    const created = parseCreateTimeEntryResult(payload._data);
    if (!created) {
      throw createError({
        statusCode: 502,
        data: { messageKey: 'error.remoteExportCreateFailed' } satisfies ApiMessage,
      });
    }
    return created;
  } catch (err: unknown) {
    if ((err as { statusCode?: number })?.statusCode === 502) throw err;
    throw mapUpstreamError(err, {
      failureMessageKey: 'error.remoteExportCreateFailed',
    });
  }
}

function normalizeProxyBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function assertSameOrigin(targetUrl: string, allowedOrigin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw createError({
      statusCode: 400,
      data: { messageKey: 'error.remoteProxyOriginRejected' } satisfies ApiMessage,
    });
  }
  if (parsed.origin !== allowedOrigin) {
    throw createError({
      statusCode: 400,
      data: { messageKey: 'error.remoteProxyOriginRejected' } satisfies ApiMessage,
    });
  }
}

function getUpstreamStatus(err: unknown): number | undefined {
  return (
    (err as { statusCode?: number; response?: { status?: number } })?.statusCode ??
    (err as { response?: { status?: number } })?.response?.status
  );
}

function mapUpstreamError(
  err: unknown,
  options: {
    mode?: RemoteIssueSearchMode;
    failureMessageKey: string;
  },
): ReturnType<typeof createError> {
  const status = getUpstreamStatus(err);

  if (status === 404 && options.mode === 'id') {
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
      data: { messageKey: options.failureMessageKey } satisfies ApiMessage,
    });
  }

  // No HTTP status at all: connection refused, timeout, or DNS failure.
  return createError({
    statusCode: 502,
    data: { messageKey: 'error.remoteProxyConnectionFailed' } satisfies ApiMessage,
  });
}
