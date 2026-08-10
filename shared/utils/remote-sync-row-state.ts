import type { RemoteSyncRowState, RemoteSyncRowStateInput } from '../types/remote-sync-day';
import type { TrackerSystemType } from '../types/tracker';

/** System types with a registered adapter. */
export const IMPLEMENTED_SYSTEM_TYPES = new Set<TrackerSystemType>(['openproject', 'redmine']);

/** True when `systemType` has a registered remote adapter. */
export function isImplementedTrackerSystemType(
  systemType: string,
): systemType is TrackerSystemType {
  return IMPLEMENTED_SYSTEM_TYPES.has(systemType as TrackerSystemType);
}

/**
 * Pure, precedence-ordered mapping from a Task's resolvable Project/tracker
 * state to its explicit Remote Sync row state:
 * `no_project` → `no_tracker` → `system_not_implemented` → `unlinked` →
 * optional activity outcome (`activity_loading` / `activity_error` /
 * `no_activity`) → `manageable`.
 */
export function deriveRemoteSyncRowState(input: RemoteSyncRowStateInput): RemoteSyncRowState {
  if (!input.hasProject) {
    return 'no_project';
  }
  if (!input.hasTracker || !input.config) {
    return 'no_tracker';
  }
  if (!IMPLEMENTED_SYSTEM_TYPES.has(input.config.systemType)) {
    return 'system_not_implemented';
  }
  if (!input.hasIssueRef) {
    return 'unlinked';
  }

  switch (input.activityStatus) {
    case 'loading':
      return 'activity_loading';
    case 'error':
      return 'activity_error';
    case 'empty':
      return 'no_activity';
    case 'available':
    default:
      return 'manageable';
  }
}
