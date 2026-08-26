import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteActivities } from '../../app/composables/use-remote-activities';
import type { TrackerDto } from '../../shared/types/tracker';

const getActivityOptionsMock = vi.fn();
const getSecretMock = vi.fn(() => 'secret');

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: () => ({
    getActivityOptions: getActivityOptionsMock,
  }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/use-tracker-secret', () => ({
  useTrackerSecret: () => ({ get: getSecretMock }),
}));

const config: TrackerDto = {
  id: 'cfg-1',
  name: 'Tracker 1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  requiredFieldDefaults: {},
  createdAt: '',
  updatedAt: '',
};

describe('useRemoteActivities', () => {
  beforeEach(() => {
    getActivityOptionsMock.mockReset();
    getSecretMock.mockClear();
  });

  it('loads options into a scope-keyed cache and exposes selectors', async () => {
    getActivityOptionsMock.mockResolvedValue([{ id: 'a1', name: 'Development' }]);
    const { ensureLoaded, stateFor } = useRemoteActivities();

    expect(stateFor(config.id, '42').loaded).toBe(false);
    await ensureLoaded(config, '42');

    const state = stateFor(config.id, '42');
    expect(state.loaded).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.errorKey).toBeNull();
    expect(state.options).toEqual([{ id: 'a1', name: 'Development' }]);
    expect(getActivityOptionsMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes in-flight loads and skips already-loaded scopes', async () => {
    let resolveFetch: (value: { id: string; name: string }[]) => void = () => undefined;
    getActivityOptionsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { ensureLoaded } = useRemoteActivities();

    const first = ensureLoaded(config, '7');
    const second = ensureLoaded(config, '7');
    resolveFetch([{ id: 'a1', name: 'Dev' }]);
    await Promise.all([first, second]);

    expect(getActivityOptionsMock).toHaveBeenCalledTimes(1);
    await ensureLoaded(config, '7');
    expect(getActivityOptionsMock).toHaveBeenCalledTimes(1);
  });

  it('records errors and retries on force', async () => {
    getActivityOptionsMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ id: 'a2', name: 'Support' }]);
    const { ensureLoaded, retry, stateFor } = useRemoteActivities();

    await ensureLoaded(config, '9');
    expect(stateFor(config.id, '9').errorKey).toBe('error.remoteActivitiesFetchFailed');
    expect(stateFor(config.id, '9').options).toEqual([]);

    await retry(config, '9');
    expect(stateFor(config.id, '9').errorKey).toBeNull();
    expect(stateFor(config.id, '9').options).toEqual([{ id: 'a2', name: 'Support' }]);
    expect(getActivityOptionsMock).toHaveBeenCalledTimes(2);
  });
});
