import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { defineComponent, h } from 'vue';
import { useTimer } from '../../app/composables/useTimer';

const csrfFetchMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(csrfFetchMock, {
      create: () => csrfFetchMock,
      raw: csrfFetchMock,
      native: csrfFetchMock,
    }),
  };
});

/** Mounts a throwaway host component so `useTimer()` runs inside a real Nuxt app context. */
async function setupTimer() {
  let api!: ReturnType<typeof useTimer>;
  const Host = defineComponent({
    setup() {
      api = useTimer();
      return () => h('div');
    },
  });
  await mountSuspended(Host);
  return api;
}

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('$fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with no running entry and zero elapsed time', async () => {
    const { running, elapsedSeconds } = await setupTimer();
    expect(running.value).toBeNull();
    expect(elapsedSeconds.value).toBe(0);
  });

  it('loading is true during the in-flight running fetch and false after it resolves (running entry)', async () => {
    const startedAt = new Date().toISOString();
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { loading, fetchRunning } = await setupTimer();
    expect(loading.value).toBe(false);

    const fetchPromise = fetchRunning();
    expect(loading.value).toBe(true);

    resolveFetch({
      id: 'entry-3',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt,
      stoppedAt: null,
    });
    await fetchPromise;

    expect(loading.value).toBe(false);
  });

  it('loading is true during the in-flight running fetch and false after it resolves (no running entry)', async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { loading, fetchRunning } = await setupTimer();
    expect(loading.value).toBe(false);

    const fetchPromise = fetchRunning();
    expect(loading.value).toBe(true);

    resolveFetch(null);
    await fetchPromise;

    expect(loading.value).toBe(false);
  });

  it('start() sets the running entry and begins ticking elapsed time', async () => {
    const startedAt = new Date().toISOString();
    csrfFetchMock.mockResolvedValueOnce({
      id: 'entry-1',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt,
      stoppedAt: null,
    });

    const { running, elapsedSeconds, start } = await setupTimer();
    await start('My Task', null);

    expect(running.value?.id).toBe('entry-1');
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.advanceTimersByTime(3000);
    expect(elapsedSeconds.value).toBeGreaterThanOrEqual(2);
  });

  it('stop() clears the running entry and resets elapsed time', async () => {
    const startedAt = new Date().toISOString();
    csrfFetchMock.mockResolvedValueOnce({
      id: 'entry-2',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt,
      stoppedAt: null,
    });
    const { running, elapsedSeconds, start, stop } = await setupTimer();
    await start(undefined, undefined);
    expect(running.value?.id).toBe('entry-2');

    csrfFetchMock.mockResolvedValueOnce({
      id: 'entry-2',
      taskId: null,
      taskName: null,
      projectId: null,
      projectName: null,
      clientName: null,
      startedAt,
      stoppedAt: new Date().toISOString(),
    });
    await stop();

    expect(running.value).toBeNull();
    expect(elapsedSeconds.value).toBe(0);
    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/time-entries/entry-2',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
