import type { TimeEntryDto } from '../../shared/types/time-entry';

/**
 * Shared running-timer state and actions. Uses `useState` so the running
 * entry is shared across the app shell (single source of truth for the
 * timer widget mounted in the top bar and the stacked mobile row).
 *
 * The authenticated layout SSR-seeds `timer-running-entry`; the live elapsed
 * ticker is client-only and starts at zero until `resumeTickerIfNeeded`.
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

  /** Client-only: elapsed stays 0 until the ticker starts after hydrate. */
  function startTicker() {
    stopTicker();
    if (!import.meta.client || !running.value) return;
    elapsedSeconds.value = computeElapsedSeconds(running.value);
    intervalId = setInterval(() => {
      if (running.value) {
        elapsedSeconds.value = computeElapsedSeconds(running.value);
      }
    }, 1000);
  }

  /**
   * Apply a resolved running entry (e.g. SSR seed) without toggling the
   * loading gate or starting the ticker. Call `resumeTickerIfNeeded` on the client.
   */
  function seedRunning(entry: TimeEntryDto | null) {
    running.value = entry;
    if (!entry) {
      stopTicker();
      elapsedSeconds.value = 0;
    }
  }

  /** Start the live elapsed ticker when a running entry is already seeded. */
  function resumeTickerIfNeeded() {
    if (running.value) {
      startTicker();
    }
  }

  /**
   * Mutation-driven / explicit refresh. Does not clear the previous running
   * entry until the response arrives (avoids blanking an SSR-seeded title).
   */
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

  async function start(
    title?: string | null,
    projectId?: string | null,
    taskId?: string | null,
  ): Promise<void> {
    const body: { title?: string | null; projectId?: string | null; taskId?: string | null } = {};
    if (taskId) {
      body.taskId = taskId;
    } else {
      body.title = title;
      body.projectId = projectId;
    }
    const entry = await $csrfFetch<TimeEntryDto>('/api/time-entries', {
      method: 'POST',
      body,
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

  async function updateTitle(title: string | null, taskId?: string | null): Promise<void> {
    if (!running.value) return;
    const body: { title?: string | null; taskId?: string } = {};
    if (taskId) {
      body.taskId = taskId;
    } else {
      body.title = title && title.trim().length > 0 ? title : null;
    }
    const entry = await $csrfFetch<TimeEntryDto>(`/api/time-entries/${running.value.id}`, {
      method: 'PATCH',
      body,
    });
    running.value = entry;
  }

  async function updateStartedAt(startedAt: string): Promise<void> {
    if (!running.value) return;
    const entry = await $csrfFetch<TimeEntryDto>(`/api/time-entries/${running.value.id}`, {
      method: 'PATCH',
      body: { startedAt },
    });
    running.value = entry;
    startTicker();
  }

  onScopeDispose(() => {
    stopTicker();
  });

  return {
    running: readonly(running),
    elapsedSeconds: readonly(elapsedSeconds),
    loading: readonly(loading),
    seedRunning,
    resumeTickerIfNeeded,
    fetchRunning,
    start,
    stop,
    updateTitle,
    updateStartedAt,
  };
}
