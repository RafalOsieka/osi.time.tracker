import type { TimeEntryDto } from '../../shared/types/time-entry';

/**
 * Shared running-timer state and actions. Uses `useState` so the running
 * entry is shared across the app shell (single source of truth for the
 * timer widget mounted in the top bar and the stacked mobile row).
 */
export function useTimer() {
  const running = useState<TimeEntryDto | null>('timer-running-entry', () => null);
  const elapsedSeconds = useState<number>('timer-elapsed-seconds', () => 0);
  const loading = useState<boolean>('timer-loading', () => false);
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const { $csrfFetch } = useNuxtApp();

  function computeElapsedSeconds(entry: TimeEntryDto): number {
    return Math.max(0, Math.floor((Date.now() - new Date(entry.startedAt).getTime()) / 1000));
  }

  function stopTicker() {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  function startTicker() {
    stopTicker();
    if (!running.value) return;
    elapsedSeconds.value = computeElapsedSeconds(running.value);
    intervalId = setInterval(() => {
      if (running.value) {
        elapsedSeconds.value = computeElapsedSeconds(running.value);
      }
    }, 1000);
  }

  async function fetchRunning(): Promise<void> {
    loading.value = true;
    try {
      const entry = await $fetch<TimeEntryDto | null>('/api/time-entries/running');
      running.value = entry;
      if (entry) {
        startTicker();
      } else {
        stopTicker();
        elapsedSeconds.value = 0;
      }
    } finally {
      loading.value = false;
    }
  }

  async function start(title?: string | null, projectId?: string | null): Promise<void> {
    const entry = await $csrfFetch<TimeEntryDto>('/api/time-entries', {
      method: 'POST',
      body: { title, projectId },
    });
    running.value = entry;
    startTicker();
  }

  async function stop(): Promise<void> {
    if (!running.value) return;
    await $csrfFetch<TimeEntryDto>(`/api/time-entries/${running.value.id}`, {
      method: 'PATCH',
      body: { stoppedAt: new Date().toISOString() },
    });
    running.value = null;
    stopTicker();
    elapsedSeconds.value = 0;
  }

  async function updateTitle(title: string | null): Promise<void> {
    if (!running.value) return;
    const normalized = title && title.trim().length > 0 ? title : null;
    const entry = await $csrfFetch<TimeEntryDto>(`/api/time-entries/${running.value.id}`, {
      method: 'PATCH',
      body: { title: normalized },
    });
    running.value = entry;
  }

  onScopeDispose(() => {
    stopTicker();
  });

  return {
    running: readonly(running),
    elapsedSeconds: readonly(elapsedSeconds),
    loading: readonly(loading),
    fetchRunning,
    start,
    stop,
    updateTitle,
  };
}
