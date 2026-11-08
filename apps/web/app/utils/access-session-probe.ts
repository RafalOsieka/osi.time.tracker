const MIN_PROBE_INTERVAL_MS = 60_000;

/**
 * Builds the check that runs when the user returns to an open tab (core-authentication
 * REQ-533). A redirect on the session request means an access layer in front of the app has
 * expired: later API calls would fail with nothing to show for it, so the page reloads and
 * re-authentication starts at once. Any other outcome leaves the page alone.
 */
export function createAccessSessionProbe({
  fetchSession,
  reload,
  now = Date.now,
}: {
  fetchSession: () => Promise<Pick<Response, 'type'>>;
  reload: () => void;
  now?: () => number;
}): () => Promise<void> {
  let lastProbeAt = Number.NEGATIVE_INFINITY;

  return async () => {
    if (now() - lastProbeAt < MIN_PROBE_INTERVAL_MS) return;
    lastProbeAt = now();

    const response = await fetchSession().catch(() => null);
    if (response?.type === 'opaqueredirect') reload();
  };
}
