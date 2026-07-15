import { ref } from 'vue';
import {
  buildIssueByIdRequest,
  buildTitleSearchRequest,
  parseIssueByIdResult,
  parseTitleSearchResults,
} from '../../shared/utils/openproject-adapter';
import { REMOTE_PROXY_SECRET_HEADER } from '../../shared/config/remote-proxy';
import { extractMessageKey } from '../utils/extractMessageKey';
import type {
  ProxiedRemoteIssueSearchDto,
  ProxiedRemoteIssueSearchResponseDto,
  RemoteIssueSearchMode,
  RemoteIssueSearchResult,
} from '../../shared/types/remote-issue-ref';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

export const REMOTE_ISSUE_SEARCH_MIN_TITLE_LENGTH = 3;

export interface RemoteIssueSearchInput {
  mode: RemoteIssueSearchMode;
  query: string;
}

/**
 * OpenProject search transport, selected per-request by the configuration's
 * `transportMode` (REQ-TTR-106): `direct` builds requests via the shared
 * adapter and authenticates straight against the configured OpenProject
 * base URL with the browser-held credential (never through `$fetch` /
 * `useCsrfFetch`, so the OSI session/CSRF material never leaks to a
 * third-party origin); `proxied` sends the search and the per-request
 * secret to the OSI server, which forwards it to the tracker. Both modes
 * expose the same bounded, stale-suppressed results.
 */
export function useRemoteIssueSearch(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const results = ref<RemoteIssueSearchResult[]>([]);
  const loading = ref(false);
  const errorKey = ref<string | null>(null);

  // Monotonically increasing token used to suppress stale/superseded responses.
  let requestToken = 0;

  function validate(input: RemoteIssueSearchInput): string | null {
    const value = input.query.trim();
    if (input.mode === 'title') {
      if (value.length < REMOTE_ISSUE_SEARCH_MIN_TITLE_LENGTH) {
        return 'error.remoteIssueSearchTitleTooShort';
      }
      return null;
    }
    if (value.length === 0) {
      return 'error.remoteIssueSearchIdInvalid';
    }
    return null;
  }

  async function search(input: RemoteIssueSearchInput): Promise<void> {
    const validationError = validate(input);
    if (validationError) {
      errorKey.value = validationError;
      results.value = [];
      loading.value = false;
      return;
    }

    const value = input.query.trim();
    const token = ++requestToken;
    loading.value = true;
    errorKey.value = null;

    const secret = getSecret(config.id);

    try {
      const searchResults =
        config.transportMode === 'proxied'
          ? await searchProxied(input.mode, value, secret)
          : await searchDirect(input.mode, value, secret);

      // A superseded request must never overwrite newer results/errors.
      if (token !== requestToken) return;

      results.value = searchResults;
      if (input.mode === 'id' && searchResults.length === 0) {
        errorKey.value = 'error.remoteIssueSearchNotFound';
      }
    } catch (err: unknown) {
      if (token !== requestToken) return;
      results.value = [];
      errorKey.value = extractMessageKey(err, 'error.remoteIssueSearchFailed');
    } finally {
      if (token === requestToken) {
        loading.value = false;
      }
    }
  }

  /**
   * `direct` transport: queries the configured OpenProject origin straight
   * from the browser with the browser-held credential.
   */
  async function searchDirect(
    mode: RemoteIssueSearchMode,
    value: string,
    secret: string | null,
  ): Promise<RemoteIssueSearchResult[]> {
    const request =
      mode === 'title'
        ? buildTitleSearchRequest(config.baseUrl, value)
        : buildIssueByIdRequest(config.baseUrl, value);

    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
      },
    });

    if (mode === 'id') {
      if (response.status === 404) return [];
      if (!response.ok) throw toDirectTransportError('error.remoteIssueSearchFailed');
      const payload = await response.json();
      const result = parseIssueByIdResult(payload, response.status);
      return result ? [result] : [];
    }

    if (!response.ok) throw toDirectTransportError('error.remoteIssueSearchFailed');
    const payload = await response.json();
    return parseTitleSearchResults(payload);
  }

  /**
   * `proxied` transport: sends the search and the per-request secret to the
   * OSI server (REQ-TTR-111/112), which forwards it to the tracker. The
   * secret is attached only to this request header and never persisted.
   */
  async function searchProxied(
    mode: RemoteIssueSearchMode,
    value: string,
    secret: string | null,
  ): Promise<RemoteIssueSearchResult[]> {
    if (!secret) {
      throw toDirectTransportError('error.remoteProxySecretRequired');
    }

    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteIssueSearchDto = {
      remoteSystemConfigId: config.id,
      mode,
      query: value,
    };
    const response = await $csrfFetch<ProxiedRemoteIssueSearchResponseDto>('/api/remote/search', {
      method: 'POST',
      headers: { [REMOTE_PROXY_SECRET_HEADER]: secret },
      body,
    });

    return response.results;
  }

  return { search, results, loading, errorKey };
}

/**
 * Wraps a local (non-`$fetch`) failure in the same `data.data.messageKey`
 * shape `extractMessageKey` expects from a Nitro `createError` response, so
 * both transports report errors through one consistent path.
 */
function toDirectTransportError(messageKey: string): { data: { data: { messageKey: string } } } {
  return { data: { data: { messageKey } } };
}

/**
 * Builds the OpenProject Basic-auth token: username `apikey`, password the
 * stored API key, per OpenProject's REST API v3 convention.
 */
function encodeBasicAuth(apiKey: string): string {
  const raw = `apikey:${apiKey}`;
  if (typeof btoa === 'function') {
    return btoa(raw);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node fallback (SSR/test) has no `btoa` global on older runtimes.
  return (globalThis as any).Buffer.from(raw, 'utf-8').toString('base64');
}
