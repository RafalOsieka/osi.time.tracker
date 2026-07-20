import type { RemoteSyncRowState, RemoteSyncRowStateInput } from '../types/remote-sync-day';
import type { RemoteSystemType } from '../types/remote-system-config';

/** System types with a registered adapter. */
export const IMPLEMENTED_SYSTEM_TYPES = new Set<RemoteSystemType>(['openproject', 'redmine']);

/** True when `systemType` has a registered remote adapter. */
export function isImplementedRemoteSystemType(systemType: string): systemType is RemoteSystemType {
  return IMPLEMENTED_SYSTEM_TYPES.has(systemType as RemoteSystemType);
}

/**
 * Pure, precedence-ordered mapping from a Task's resolvable Project/Client
 * and remote-config state to its explicit Remote Sync row state:
 * `no_client` → `no_config` → `system_not_implemented` → `unlinked` →
 * optional activity outcome (`activity_loading` / `activity_error` /
 * `no_activity`) → `manageable`.
 */
export function deriveRemoteSyncRowState(input: RemoteSyncRowStateInput): RemoteSyncRowState {
  if (!input.hasProject || !input.hasClient) {
    return 'no_client';
  }
  if (!input.config) {
    return 'no_config';
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
