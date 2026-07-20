import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import { extractRemoteErrorKey } from '../utils/remote/extract-remote-error-key';
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
 * State-only issue search over the `RemoteTrackerAdapter` selected for
 * `config.executionMode` (REQ-TTR-106): loading/results/error state and
 * stale-response suppression live here; all I/O and provider quirks are
 * delegated to the adapter, which behaves identically regardless of
 * execution mode.
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
    const adapter = createRemoteAdapter(config, secret);

    try {
      const searchResults =
        input.mode === 'id'
          ? await adapter.getIssueById(value).then((result) => (result ? [result] : []))
          : await adapter.searchIssues(value);

      // A superseded request must never overwrite newer results/errors.
      if (token !== requestToken) return;

      results.value = searchResults;
      if (input.mode === 'id' && searchResults.length === 0) {
        errorKey.value = 'error.remoteIssueSearchNotFound';
      }
    } catch (err: unknown) {
      if (token !== requestToken) return;
      results.value = [];
      errorKey.value = extractRemoteErrorKey(err, 'error.remoteIssueSearchFailed');
    } finally {
      if (token === requestToken) {
        loading.value = false;
      }
    }
  }

  return { search, results, loading, errorKey };
}
