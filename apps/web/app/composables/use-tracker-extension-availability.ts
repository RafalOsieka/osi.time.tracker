import { computed, ref, watch } from 'vue';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import {
  probeExtensionAvailability,
  type ExtensionAvailabilityStatus,
} from '~/utils/remote/extension-availability';
import type { TrackerExecutionMode } from '~~/shared/types/tracker';

export type TrackerExtensionUiStatus = 'idle' | 'checking' | ExtensionAvailabilityStatus;

function destinationFrom(systemType: TrackerSystemType, baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return { provider: systemType, baseUrl: trimmed };
  } catch {
    return undefined;
  }
}

/**
 * Live extension availability for the tracker form. Probes only in the
 * browser and never sends a tracker secret.
 */
export function useTrackerExtensionAvailability(
  source: () => {
    executionMode: TrackerExecutionMode;
    systemType: TrackerSystemType;
    baseUrl: string;
  },
  options: {
    isClient?: boolean;
    probe?: typeof probeExtensionAvailability;
  } = {},
) {
  const status = ref<TrackerExtensionUiStatus>('idle');
  const messageKey = ref('error.extensionUnavailable');
  const checking = computed(() => status.value === 'checking');
  const visible = computed(() => source().executionMode === 'extension');

  async function recheck(): Promise<void> {
    if (!visible.value) {
      status.value = 'idle';
      return;
    }
    const isClient = options.isClient ?? import.meta.client;
    if (!isClient) {
      status.value = 'unavailable';
      messageKey.value = 'error.extensionUnavailable';
      return;
    }

    status.value = 'checking';
    const snapshot = source();
    const destination = destinationFrom(snapshot.systemType, snapshot.baseUrl);
    const result = await (options.probe ?? probeExtensionAvailability)({
      isClient: true,
      destination,
    });
    if (source().executionMode !== 'extension') {
      status.value = 'idle';
      return;
    }
    status.value = result.status;
    messageKey.value = result.messageKey;
  }

  watch(
    () => {
      const snapshot = source();
      return [snapshot.executionMode, snapshot.systemType, snapshot.baseUrl] as const;
    },
    () => {
      void recheck();
    },
    { immediate: true },
  );

  return { status, messageKey, checking, visible, recheck };
}
