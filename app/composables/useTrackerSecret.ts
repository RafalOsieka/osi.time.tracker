const STORAGE_KEY_PREFIX = 'rsc:';

/**
 * Manages the browser-held API secret for a tracker.
 *
 * The secret is persisted only in `localStorage`, keyed by tracker id, and is
 * never sent to the server: it is used exclusively by the client when
 * performing the on-demand push of a time entry to the remote system.
 * The `rsc:` prefix is retained for backward compatibility with secrets stored
 * before the Clients → Trackers rename.
 */
export function useTrackerSecret() {
  function key(trackerId: string) {
    return `${STORAGE_KEY_PREFIX}${trackerId}`;
  }

  function get(trackerId: string): string | null {
    if (!import.meta.client) return null;
    return window.localStorage.getItem(key(trackerId));
  }

  function set(trackerId: string, secret: string) {
    if (!import.meta.client) return;
    window.localStorage.setItem(key(trackerId), secret);
  }

  function clear(trackerId: string) {
    if (!import.meta.client) return;
    window.localStorage.removeItem(key(trackerId));
  }

  return { get, set, clear };
}
