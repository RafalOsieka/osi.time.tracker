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
  'title',
  'id',
] as const satisfies readonly RemoteIssueSearchMode[];

/**
 * Client-side form schema for the remote issue picker popover (mode + query).
 * Business validation (e.g. title min length) stays in the search composable.
 */
export const remoteIssuePickerFormSchema = z.object({
  mode: remoteIssueSearchModeSchema,
  query: z.string({ error: 'error.remoteIssueSearchQueryRequired' }),
});

export type RemoteIssuePickerFormDto = z.infer<typeof remoteIssuePickerFormSchema>;

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
 * the remote issue id and its title are exposed to shared/browser code.
 */
export interface RemoteIssueSearchResult {
  remoteIssueId: string;
  title: string;
}

/**
 * Request body accepted by the link endpoint. Only the remote issue id and
 * cached title (from the search result) are accepted from the client; Task
 * ownership and the Project -> active tracker provenance are derived
 * server-side (REQ-106), never accepted from the request body.
 */
export const linkRemoteIssueSchema = z.object({
  remoteIssueId: z
    .string({ error: 'error.remoteIssueIdRequired' })
    .trim()
    .min(1, { error: 'error.remoteIssueIdRequired' }),
  cachedTitle: z
    .string({ error: 'error.remoteIssueTitleRequired' })
    .trim()
    .min(1, { error: 'error.remoteIssueTitleRequired' }),
});

export type LinkRemoteIssueDto = z.infer<typeof linkRemoteIssueSchema>;

/**
 * Request body accepted by the `proxied`-transport search endpoints
 * (REQ-253). The client identifies only the owned tracker and the
 * search input; the server derives the target tracker base URL from the
 * authenticated user's owned stored tracker and never accepts a
 * target URL from the client.
 */
export const proxiedRemoteIssueSearchSchema = z.object({
  trackerId: z.uuid({ error: 'error.trackerIdRequired' }),
  mode: remoteIssueSearchModeSchema,
  query: z
    .string({ error: 'error.remoteIssueSearchQueryRequired' })
    .trim()
    .min(1, { error: 'error.remoteIssueSearchQueryRequired' }),
});

export type ProxiedRemoteIssueSearchDto = z.infer<typeof proxiedRemoteIssueSearchSchema>;

/**
 * Adapter-neutral response returned by the `proxied` search endpoints:
 * either a bounded list of matches (title search) or a single exact match
 * (issue-ID lookup, `results` has at most one element).
 */
export interface ProxiedRemoteIssueSearchResponseDto {
  results: RemoteIssueSearchResult[];
}

/**
 * Persisted remote issue reference DTO. `url` is included only when the
 * reference's `trackerId` currently points to an active (non-soft-deleted)
 * tracker; otherwise it is omitted and only the cached id/title remain
 * available as provenance.
 */
export interface RemoteIssueRefDto {
  id: string;
  taskId: string;
  userId: string;
  trackerId: string;
  remoteIssueId: string;
  cachedTitle: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}
