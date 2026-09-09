import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { TrackerDto } from '../../shared/types/tracker';
import {
  deriveExtensionAggregateState,
  orderReadinessTrackers,
  probeExtensionReadiness,
  type ExtensionReadinessSnapshot,
  type ExtensionReadinessTracker,
} from '~/utils/remote/extension-readiness';

function toReadinessTrackers(trackers: TrackerDto[]) {
  return orderReadinessTrackers(
    trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      systemType: tracker.systemType,
      baseUrl: tracker.baseUrl,
      directBrowserAccess: tracker.directBrowserAccess,
      destinationApproved: null,
    })),
  );
}

function mergeReadinessTrackers(
  listed: ExtensionReadinessTracker[],
  previous: ExtensionReadinessTracker[],
): ExtensionReadinessTracker[] {
  const previousById = new Map(previous.map((tracker) => [tracker.id, tracker]));
  return listed.map((tracker) => {
    if (tracker.destinationApproved != null) return tracker;
    const prior = previousById.get(tracker.id);
    if (!prior) return tracker;
    return { ...tracker, destinationApproved: prior.destinationApproved };
  });
}

/**
 * Device-local extension readiness for the authenticated sidebar. Never
 * sends tracker secrets.
 */
export function useExtensionReadiness(
  options: {
    isClient?: boolean;
    probe?: typeof probeExtensionReadiness;
  } = {},
) {
  const { trackersById, ensureAllLoaded } = useActiveTrackers();
  const snapshot = ref<ExtensionReadinessSnapshot>({
    connection: 'checking',
    messageKey: 'error.extensionUnavailable',
    aggregate: 'checking',
    trackers: [],
  });
  const aggregate = computed(() => snapshot.value.aggregate);
  let inFlight: Promise<void> | null = null;
  let queued = false;

  function applySnapshot(partial: ExtensionReadinessSnapshot) {
    const trackers = mergeReadinessTrackers(partial.trackers, snapshot.value.trackers);
    snapshot.value = {
      ...partial,
      trackers,
      aggregate: deriveExtensionAggregateState({
        trackers,
        connection: partial.connection,
      }),
    };
  }

  async function runRecheck(): Promise<void> {
    await ensureAllLoaded();
    const trackers = Object.values(trackersById.value).filter(
      (tracker): tracker is TrackerDto => tracker !== null,
    );
    const listed = mergeReadinessTrackers(toReadinessTrackers(trackers), snapshot.value.trackers);
    const requiresExtension = listed.some((tracker) => !tracker.directBrowserAccess);
    if (!requiresExtension) {
      snapshot.value = {
        connection: 'ready',
        messageKey: 'layout.extensionStatus.notRequired',
        aggregate: 'neutral',
        trackers: listed,
      };
      return;
    }

    snapshot.value = {
      ...snapshot.value,
      trackers: listed,
    };

    const isClient = options.isClient ?? import.meta.client;
    if (!isClient) return;
    const next = await (options.probe ?? probeExtensionReadiness)(trackers, {
      isClient: true,
      onProgress: applySnapshot,
    });
    applySnapshot(next);
  }

  async function recheck(): Promise<void> {
    if (inFlight) {
      queued = true;
      return inFlight;
    }
    inFlight = runRecheck().finally(() => {
      inFlight = null;
      if (queued) {
        queued = false;
        void recheck();
      }
    });
    return inFlight;
  }

  function onPageResume() {
    if (document.visibilityState === 'hidden') return;
    void recheck();
  }

  watch(
    () =>
      Object.values(trackersById.value)
        .filter((tracker): tracker is TrackerDto => tracker !== null)
        .map(
          (tracker) =>
            `${tracker.id}:${tracker.directBrowserAccess}:${tracker.systemType}:${tracker.baseUrl}`,
        )
        .join('|'),
    () => {
      void recheck();
    },
    { immediate: true },
  );

  onMounted(() => {
    if (!(options.isClient ?? import.meta.client)) return;
    window.addEventListener('focus', onPageResume);
    document.addEventListener('visibilitychange', onPageResume);
  });

  onUnmounted(() => {
    if (!(options.isClient ?? import.meta.client)) return;
    window.removeEventListener('focus', onPageResume);
    document.removeEventListener('visibilitychange', onPageResume);
  });

  return { snapshot, aggregate, recheck };
}
