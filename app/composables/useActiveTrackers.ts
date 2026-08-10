import type { TrackerDto } from '../../shared/types/tracker';

/**
 * Loads and caches active trackers keyed by tracker id. Shared across the
 * Timer and Remote Sync views so rows can resolve project.trackerId without
 * issuing a duplicate network request per row.
 */
export function useActiveTrackers() {
  const trackersById = useState<Record<string, TrackerDto | null>>('active-trackers', () => ({}));
  const allLoaded = useState('active-trackers-loaded', () => false);
  const loading = useState('active-trackers-loading', () => false);

  async function ensureAllLoaded(): Promise<void> {
    if (allLoaded.value || loading.value) return;
    loading.value = true;
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
      allLoaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(trackerId: string): Promise<void> {
    if (trackerId in trackersById.value) return;
    await ensureAllLoaded();
    if (!(trackerId in trackersById.value)) {
      trackersById.value = { ...trackersById.value, [trackerId]: null };
    }
  }

  function getTracker(trackerId: string | null | undefined): TrackerDto | null {
    if (!trackerId) return null;
    return trackersById.value[trackerId] ?? null;
  }

  return { trackersById, ensureLoaded, ensureAllLoaded, getTracker };
}
