import { computed, ref, watch } from 'vue';
import type { TrackerDto } from '../../shared/types/tracker';
import {
  orderReadinessTrackers,
  probeExtensionReadiness,
  type ExtensionReadinessSnapshot,
} from '~/utils/remote/extension-readiness';
import { probeExtensionAvailability } from '~/utils/remote/extension-availability';
import type { DestinationSelector } from '@osi/extension-protocol';

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

function destinationOf(tracker: {
  systemType: TrackerDto['systemType'];
  baseUrl: string;
}): DestinationSelector | undefined {
  try {
    const parsed = new URL(tracker.baseUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return { provider: tracker.systemType, baseUrl: tracker.baseUrl.trim() };
  } catch {
    return undefined;
  }
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
  let generation = 0;

  async function recheck(): Promise<void> {
    const requestGeneration = ++generation;
    await ensureAllLoaded();
    const trackers = Object.values(trackersById.value).filter(
      (tracker): tracker is TrackerDto => tracker !== null,
    );
    const listed = toReadinessTrackers(trackers);
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
      connection: 'checking',
      aggregate: 'checking',
      trackers: listed,
    };

    const isClient = options.isClient ?? import.meta.client;
    if (!isClient) return;
    const next = await (options.probe ?? probeExtensionReadiness)(trackers, { isClient: true });
    if (requestGeneration !== generation) return;
    snapshot.value = next;
  }

  async function approveDestination(trackerId: string): Promise<void> {
    const tracker = snapshot.value.trackers.find((item) => item.id === trackerId);
    if (!tracker) return;
    const destination = destinationOf(tracker);
    if (!destination) return;
    await probeExtensionAvailability({
      isClient: options.isClient ?? import.meta.client,
      destination,
    });
    await recheck();
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

  return { snapshot, aggregate, recheck, approveDestination };
}
