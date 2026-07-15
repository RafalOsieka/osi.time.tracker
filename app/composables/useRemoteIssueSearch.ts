import { ref } from 'vue';
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
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

export const REMOTE_ISSUE_SEARCH_MIN_TITLE_LENGTH = 3;

export interface RemoteIssueSearchInput {
  mode: RemoteIssueSearchMode;
  query: string;
}

/**
 * Browser-side OpenProject search transport. Builds requests using the
 * shared adapter, authenticates directly against the configured OpenProject
 * base URL with the browser-held credential (never through `$fetch` /
 * `useCsrfFetch`, so the OSI session/CSRF material never leaks to a
 * third-party origin), and exposes bounded, stale-suppressed results.
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
    const request =
      input.mode === 'title'
        ? buildTitleSearchRequest(config.baseUrl, value)
        : buildIssueByIdRequest(config.baseUrl, value);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
        },
      });

      // A superseded request must never overwrite newer results/errors.
      if (token !== requestToken) {
        return;
      }

      if (input.mode === 'id') {
        if (response.status === 404) {
          results.value = [];
          errorKey.value = 'error.remoteIssueSearchNotFound';
          return;
        }
        if (!response.ok) {
          results.value = [];
          errorKey.value = 'error.remoteIssueSearchFailed';
          return;
        }
        const payload = await response.json();
        if (token !== requestToken) return;
        const result = parseIssueByIdResult(payload, response.status);
        results.value = result ? [result] : [];
        if (!result) {
          errorKey.value = 'error.remoteIssueSearchNotFound';
        }
        return;
      }

      if (!response.ok) {
        results.value = [];
        errorKey.value = 'error.remoteIssueSearchFailed';
        return;
      }

      const payload = await response.json();
      if (token !== requestToken) return;
      results.value = parseTitleSearchResults(payload);
    } catch {
      if (token !== requestToken) return;
      results.value = [];
      errorKey.value = 'error.remoteIssueSearchFailed';
    } finally {
      if (token === requestToken) {
        loading.value = false;
      }
    }
  }

  return { search, results, loading, errorKey };
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
