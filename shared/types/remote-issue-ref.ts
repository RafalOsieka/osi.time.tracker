import { z } from 'zod';

/**
 * Explicit search mode for the remote issue picker: `title` performs a
 * bounded title-phrase search, `id` performs an exact-issue lookup.
 */
export const remoteIssueSearchModeSchema = z.enum(['title', 'id'], {
  required_error: 'error.remoteIssueSearchModeRequired',
  invalid_type_error: 'error.remoteIssueSearchModeRequired',
});

export type RemoteIssueSearchMode = z.infer<typeof remoteIssueSearchModeSchema>;

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
 * cached title are accepted from the client; Task ownership and the
 * Project -> Client -> active configuration provenance are derived
 * server-side (REQ-106), never accepted from the request body.
 */
export const linkRemoteIssueSchema = z.object({
  remoteIssueId: z
    .string({
      required_error: 'error.remoteIssueIdRequired',
      invalid_type_error: 'error.remoteIssueIdRequired',
    })
    .trim()
    .min(1, { message: 'error.remoteIssueIdRequired' }),
  cachedTitle: z
    .string({
      required_error: 'error.remoteIssueTitleRequired',
      invalid_type_error: 'error.remoteIssueTitleRequired',
    })
    .trim()
    .min(1, { message: 'error.remoteIssueTitleRequired' }),
});

export type LinkRemoteIssueDto = z.infer<typeof linkRemoteIssueSchema>;

/**
 * Request body accepted by the `proxied`-transport search endpoints
 * (REQ-108). The client identifies only the owned configuration and the
 * search input; the server derives the target tracker base URL from the
 * authenticated user's owned stored configuration and never accepts a
 * target URL from the client.
 */
export const proxiedRemoteIssueSearchSchema = z.object({
  remoteSystemConfigId: z
    .string({
      required_error: 'error.remoteConfigIdRequired',
      invalid_type_error: 'error.remoteConfigIdRequired',
    })
    .uuid({ message: 'error.remoteConfigIdRequired' }),
  mode: remoteIssueSearchModeSchema,
  query: z
    .string({
      required_error: 'error.remoteIssueSearchQueryRequired',
      invalid_type_error: 'error.remoteIssueSearchQueryRequired',
    })
    .trim()
    .min(1, { message: 'error.remoteIssueSearchQueryRequired' }),
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
 * reference's `remoteSystemConfigId` currently points to an active
 * (non-soft-deleted) configuration; otherwise it is omitted and only the
 * cached id/title remain available as provenance.
 */
export interface RemoteIssueRefDto {
  id: string;
  taskId: string;
  userId: string;
  remoteSystemConfigId: string;
  remoteIssueId: string;
  cachedTitle: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}
