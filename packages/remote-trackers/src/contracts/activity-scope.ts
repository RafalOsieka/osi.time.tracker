import type { TrackerSystemType } from './tracker-system-type.js';

/** Tracker-wide activity scope key for providers whose activities are a global enumeration. */
const TRACKER_WIDE_ACTIVITY_SCOPE = '*';

type ActivityScopeResolver = (remoteIssueId: string) => string;

const ACTIVITY_SCOPE_RESOLVERS = {
  // OpenProject activity options depend on the work package (its type may
  // disallow time logging entirely), so each issue is its own scope.
  openproject: (remoteIssueId) => remoteIssueId,
  // Redmine activities come from the global enumeration (MVP): every issue
  // on the tracker resolves to the same scope.
  redmine: () => TRACKER_WIDE_ACTIVITY_SCOPE,
} as const satisfies Record<TrackerSystemType, ActivityScopeResolver>;

/**
 * Resolves the activity-options scope a remote issue belongs to, without any
 * remote request, via a per-provider dispatch table (mirrors `deriveIssueUrl`).
 * Callers fetch activity options once per distinct scope key and reuse the
 * result for every issue that resolves to it.
 */
export function resolveActivityScope(systemType: TrackerSystemType, remoteIssueId: string): string {
  return ACTIVITY_SCOPE_RESOLVERS[systemType](remoteIssueId);
}
