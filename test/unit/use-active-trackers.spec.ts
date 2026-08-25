import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import type { TrackerDto } from '../../shared/types/tracker';

const fetchMock = vi.fn();
type StateValue = TrackerDto[] | Map<string, TrackerDto | null> | undefined;
const useStateStore = new Map<string, Ref<StateValue>>();

vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useState', (key: string, init?: () => StateValue) => {
  if (!useStateStore.has(key)) {
    useStateStore.set(key, ref(init ? init() : undefined));
  }
  return useStateStore.get(key);
});

const { useActiveTrackers } = await import('../../app/composables/useActiveTrackers');

const tracker: TrackerDto = {
  id: 'tr-1',
  name: 'Acme',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  requiredFieldDefaults: {},
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

  it('stores unknown tracker ids as null after a successful load', async () => {
    fetchMock.mockResolvedValue([tracker]);
    const { ensureLoaded, getTracker } = useActiveTrackers();
    await ensureLoaded('missing');
    expect(getTracker('missing')).toBeNull();
    expect(getTracker(null)).toBeNull();
  });
});
