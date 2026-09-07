import { z } from 'zod';

/**
 * Explicit search mode for the remote issue picker: `title` performs a
 * bounded title-phrase search, `id` performs an exact-issue lookup.
 */
export const remoteIssueSearchModeSchema = z.enum(['title', 'id'], {
  error: 'error.remoteIssueSearchModeRequired',
});

export type RemoteIssueSearchMode = z.infer<typeof remoteIssueSearchModeSchema>;

/** Stable display order for remote-issue search mode selects. */
export const REMOTE_ISSUE_SEARCH_MODE_ORDER = [
  'id',
  'title',
] as const satisfies readonly RemoteIssueSearchMode[];

/**
 * Adapter-neutral search query: `title` mode carries a trimmed phrase,
 * `id` mode carries the exact remote issue id.
 */
export interface RemoteIssueSearchQuery {
  mode: RemoteIssueSearchMode;
  value: string;
}

/**
 * Adapter-neutral search/lookup result item. Regardless of adapter, only
 * the remote issue id, title, and optional remote project title are exposed
 * to callers — never a remote project id.
 */
export interface RemoteIssueSearchResult {
  remoteIssueId: string;
  title: string;
  remoteProjectTitle?: string;
}
