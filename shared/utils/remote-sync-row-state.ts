import type { RemoteSyncRowState, RemoteSyncRowStateInput } from '../types/remote-sync-day';

/** System types with an implemented adapter (only OpenProject, for now). */
const IMPLEMENTED_SYSTEM_TYPES = new Set(['openproject']);

/**
 * Pure, precedence-ordered mapping from a Task's resolvable Project/Client
 * and remote-config state to its explicit Remote Sync row state:
 * `no_client` (no Project or no resolvable Client) → `no_config` (Client
 * has no active configuration) → `system_not_implemented` (configured
 * system type has no adapter, e.g. `redmine`) → `unlinked` (usable config,
 * no `RemoteIssueRef`) → `manageable` (all prerequisites met). Story 11b
 * adds a further `pushed` precedence step ahead of `manageable`.
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
  return 'manageable';
}
