import type { RemoteSyncRowState, RemoteSyncRowStateInput } from '../types/remote-sync-day';
import { TRACKER_SYSTEM_TYPE_ORDER, type TrackerSystemType } from '../types/tracker';

/** System types with a registered adapter. */
export const IMPLEMENTED_SYSTEM_TYPES = new Set<TrackerSystemType>(TRACKER_SYSTEM_TYPE_ORDER);

/** True when `systemType` has a registered remote adapter. */
export function isImplementedTrackerSystemType(
  systemType: string | null | undefined,
): systemType is TrackerSystemType {
  if (systemType == null) return false;
  for (const implemented of TRACKER_SYSTEM_TYPE_ORDER) {
    if (implemented === systemType) return true;
  }
  return false;
}

/**
 * Pure, precedence-ordered mapping from a Task's resolvable Project/tracker
 * state to its explicit Remote Sync row state:
 * `no_project` → `no_tracker` → `system_not_implemented` → `unlinked` →
 * `sent` → optional activity outcome (`activity_loading` / `activity_error` /
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
  if (input.hasExports) {
    return 'sent';
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
