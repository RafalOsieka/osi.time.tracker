import type { TrackerDto } from '../../shared/types/tracker';

/** Per-Nuxt-app in-flight load; never useState — Promises are not payload-serializable. */
const inflightByApp = new WeakMap<object, Promise<void>>();

/**
 * Loads and caches active trackers keyed by tracker id. Shared across the
 * Timer and Remote Sync views so rows can resolve project.trackerId without
 * issuing a duplicate network request per row.
 */
export function useActiveTrackers() {
  const trackersById = useState<Record<string, TrackerDto | null>>('active-trackers', () => ({}));
  const allLoaded = useState('active-trackers-loaded', () => false);
  const nuxtApp = useNuxtApp();

  /** Load once; concurrent callers share the live request. A new app instance starts a new fetch. */
  async function ensureAllLoaded(): Promise<void> {
    if (allLoaded.value) return;
    const existing = inflightByApp.get(nuxtApp);
    if (existing) return existing;

    const pending = (async () => {
      try {
        const trackers = await $fetch<TrackerDto[]>('/api/trackers');
        const next: Record<string, TrackerDto | null> = {};
        for (const tracker of trackers) {
          next[tracker.id] = tracker;
        }
        trackersById.value = next;
        allLoaded.value = true;
      } catch {
        trackersById.value = {};
        allLoaded.value = false;
      } finally {
        inflightByApp.delete(nuxtApp);
      }
    })();

    inflightByApp.set(nuxtApp, pending);
    return pending;
  }

  function putTracker(tracker: TrackerDto): void {
    trackersById.value = { ...trackersById.value, [tracker.id]: tracker };
  }

  function dropTracker(trackerId: string): void {
    if (!(trackerId in trackersById.value)) return;
    trackersById.value = Object.fromEntries(
      Object.entries(trackersById.value).filter(([id]) => id !== trackerId),
    );
  }

  async function ensureLoaded(trackerId: string): Promise<void> {
    if (trackersById.value[trackerId]) return;
    await ensureAllLoaded();
    if (allLoaded.value && !(trackerId in trackersById.value)) {
      trackersById.value = { ...trackersById.value, [trackerId]: null };
    }
  }

  function getTracker(trackerId: string | null | undefined): TrackerDto | null {
    if (!trackerId) return null;
    return trackersById.value[trackerId] ?? null;
  }

  return { trackersById, ensureLoaded, ensureAllLoaded, putTracker, dropTracker, getTracker };
}
