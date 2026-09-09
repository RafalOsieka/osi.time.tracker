import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import type { TrackerDto } from '../../shared/types/tracker';

const fetchMock = vi.fn();
type StateValue = TrackerDto[] | Record<string, TrackerDto | null> | boolean | undefined;
const useStateStore = new Map<string, Ref<StateValue>>();
const nuxtAppStub = {};

vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useNuxtApp', () => nuxtAppStub);
vi.stubGlobal('useState', (key: string, init?: () => StateValue) => {
  if (!useStateStore.has(key)) {
    useStateStore.set(key, ref(init ? init() : undefined));
  }
  return useStateStore.get(key);
});

const { useActiveTrackers } = await import('../../app/composables/use-active-trackers');

const tracker: TrackerDto = {
  id: 'tr-1',
  name: 'Acme',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '',
  updatedAt: '',
};

describe('useActiveTrackers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    useStateStore.clear();
  });

  it('loads trackers keyed by id', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureAllLoaded, getTracker, trackersById } = useActiveTrackers();
    await ensureAllLoaded();
    expect(trackersById.value['tr-1']?.name).toBe('Acme');
    expect(getTracker('tr-1')?.id).toBe('tr-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/trackers');
  });

  it('leaves an empty map when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { ensureAllLoaded, trackersById, getTracker } = useActiveTrackers();
    await ensureAllLoaded();
    expect(trackersById.value).toEqual({});
    expect(getTracker('tr-1')).toBeNull();
  });

  it('skips a second ensureAllLoaded after a successful load', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureAllLoaded } = useActiveTrackers();
    await ensureAllLoaded();
    await ensureAllLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight load instead of returning an empty map', async () => {
    let resolveFetch: ((value: TrackerDto[]) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<TrackerDto[]>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { ensureAllLoaded, getTracker } = useActiveTrackers();
    const first = ensureAllLoaded();
    const second = ensureAllLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolveFetch).toBeDefined();
    resolveFetch?.([tracker]);
    await Promise.all([first, second]);
    expect(getTracker('tr-1')?.id).toBe('tr-1');
  });

  it('fetches when hydrated without a completed load', async () => {
    fetchMock.mockResolvedValue([tracker]);
    useStateStore.set('active-trackers', ref({}));
    useStateStore.set('active-trackers-loaded', ref(false));
    const { ensureAllLoaded, getTracker } = useActiveTrackers();
    await ensureAllLoaded();
    expect(fetchMock).toHaveBeenCalledWith('/api/trackers');
    expect(getTracker('tr-1')?.id).toBe('tr-1');
  });

  it('putTracker updates a cached tracker so readiness can refresh', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureAllLoaded, putTracker, getTracker } = useActiveTrackers();
    await ensureAllLoaded();
    putTracker({ ...tracker, directBrowserAccess: false });
    expect(getTracker('tr-1')?.directBrowserAccess).toBe(false);
  });

  it('dropTracker removes a cached tracker', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureAllLoaded, dropTracker, getTracker } = useActiveTrackers();
    await ensureAllLoaded();
    dropTracker('tr-1');
    expect(getTracker('tr-1')).toBeNull();
  });

  it('stores unknown tracker ids as null after a successful load', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureLoaded, getTracker } = useActiveTrackers();
    await ensureLoaded('missing');
    expect(getTracker('missing')).toBeNull();
    expect(getTracker(null)).toBeNull();
  });
});
