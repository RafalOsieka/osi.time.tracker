import { z } from 'zod';

const STORAGE_KEY_PREFIX = 'rsc:';

/**
 * Manages the browser-held API secret for a tracker.
 *
 * The secret is persisted only in `localStorage`, keyed by tracker id, and is
 * never sent to the server: it is used exclusively by the client when
 * performing the on-demand push of a time entry to the remote system.
 * The `rsc:` prefix is retained for backward compatibility with secrets stored
 * before the Clients → Trackers rename.
 *
 * Plaintext `localStorage` is accepted: same-origin JavaScript can always use
 * the token (client-side encryption would not change that), CSP is the XSS
 * control, and encrypted server-side credentials remain WBS 5.4.
 */
export function useTrackerSecret() {
  function key(trackerId: string) {
    return `${STORAGE_KEY_PREFIX}${trackerId}`;
  }

  function get(trackerId: string): string | null {
    if (!import.meta.client) return null;
    const parsed = z
      .string()
      .nullable()
      .safeParse(window.localStorage.getItem(key(trackerId)));
    return parsed.success ? parsed.data : null;
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
