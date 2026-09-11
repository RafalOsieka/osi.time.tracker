import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import type {
  RemoteIssueScope,
  RemoteIssueSearchMode,
  RemoteIssueSearchResult,
} from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import { extractCaughtMessageKey } from '../utils/extract-message-key';
import { useTrackerSecret } from './use-tracker-secret';

export const REMOTE_ISSUE_SEARCH_MIN_TITLE_LENGTH = 3;

export interface RemoteIssueSearchInput {
  mode: RemoteIssueSearchMode;
  query: string;
}

/**
 * State-only issue search over the `RemoteTrackerAdapter` selected for
 * `config.directBrowserAccess` (REQ-103): loading/results/error state and
 * stale-response suppression live here; all I/O and provider quirks are
 * delegated to the adapter, which behaves identically regardless of
 * transport.
 *
 * `scope` is an optional getter for the owning project's remote project
 * scope (REQ-328/REQ-329). When `search` is called with `applyScope: true`
 * and a scope is present, it is forwarded to the adapter; ID-mode results
 * outside that scope are still returned (not filtered) and flagged via
 * `outOfScopeId` rather than treated as an error.
 */
export function useRemoteIssueSearch(
  config: TrackerDto,
  scope?: () => RemoteIssueScope | null | undefined,
) {
  const { get: getSecret } = useTrackerSecret();

  const results = ref<RemoteIssueSearchResult[]>([]);
  const loading = ref(false);
  const errorKey = ref<string | null>(null);
  // Set to the single ID-mode result's id when it exists but falls outside
  // the applied scope (REQ-329); null otherwise, including for title search.
  const outOfScopeId = ref<string | null>(null);

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

  async function search(input: RemoteIssueSearchInput, applyScope = true): Promise<void> {
    const validationError = validate(input);
    if (validationError) {
      errorKey.value = validationError;
      results.value = [];
      outOfScopeId.value = null;
      loading.value = false;
      return;
    }

    const value = input.query.trim();
    const effectiveScope = applyScope ? (scope?.() ?? undefined) : undefined;
    const token = ++requestToken;
    loading.value = true;
    errorKey.value = null;

    const secret = getSecret(config.id);
    const adapter = createRemoteAdapter(config, secret);

    try {
      if (input.mode === 'id') {
        const lookup = await adapter.getIssueById(value, effectiveScope);

        // A superseded request must never overwrite newer results/errors.
        if (token !== requestToken) return;

        if (!lookup) {
          results.value = [];
          outOfScopeId.value = null;
          errorKey.value = 'error.remoteIssueSearchNotFound';
        } else {
          results.value = [lookup.result];
          outOfScopeId.value = lookup.inScope ? null : lookup.result.remoteIssueId;
        }
        return;
      }

      const searchResults = await adapter.searchIssues(value, effectiveScope);

      if (token !== requestToken) return;

      results.value = searchResults;
      outOfScopeId.value = null;
    } catch (err) {
      if (token !== requestToken) return;
      results.value = [];
      outOfScopeId.value = null;
      errorKey.value = extractCaughtMessageKey(err, 'error.remoteIssueSearchFailed');
    } finally {
      if (token === requestToken) {
        loading.value = false;
      }
    }
  }

  return { search, results, outOfScopeId, loading, errorKey };
}
