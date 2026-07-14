const STORAGE_KEY_PREFIX = 'rsc:';

/**
 * Manages the browser-held API secret for a remote system config.
 *
 * The secret is persisted only in `localStorage`, keyed by config id, and is
 * never sent to the server: it is used exclusively by the client when
 * performing the on-demand push of a time entry to the remote system.
 */
export function useRemoteConfigSecret() {
  function key(configId: string) {
    return `${STORAGE_KEY_PREFIX}${configId}`;
  }

  function get(configId: string): string | null {
    if (!import.meta.client) return null;
    return window.localStorage.getItem(key(configId));
  }

  function set(configId: string, secret: string) {
    if (!import.meta.client) return;
    window.localStorage.setItem(key(configId), secret);
  }

  function clear(configId: string) {
    if (!import.meta.client) return;
    window.localStorage.removeItem(key(configId));
  }

  return { get, set, clear };
}
