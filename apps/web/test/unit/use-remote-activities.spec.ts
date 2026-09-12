import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemoteActivities } from '../../app/composables/use-remote-activities';
import type { TrackerDto } from '../../shared/types/tracker';
import { ExtensionProtocolError } from '@osi/extension-protocol';

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
  directBrowserAccess: true,
  roundingRule: 'none',
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

    expect(stateFor(config, '42').loaded).toBe(false);
    await ensureLoaded(config, '42');

    const state = stateFor(config, '42');
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
    expect(stateFor(config, '9').errorKey).toBe('error.remoteActivitiesFetchFailed');
    expect(stateFor(config, '9').options).toEqual([]);

    await retry(config, '9');
    expect(stateFor(config, '9').errorKey).toBeNull();
    expect(stateFor(config, '9').options).toEqual([{ id: 'a2', name: 'Support' }]);
    expect(getActivityOptionsMock).toHaveBeenCalledTimes(2);
  });

  it('shares one fetch across different issues on a tracker-wide activity scope (REQ-332)', async () => {
    getActivityOptionsMock.mockResolvedValue([{ id: 'a1', name: 'Development' }]);
    const redmineConfig: TrackerDto = { ...config, systemType: 'redmine' };
    const { ensureLoaded, stateFor } = useRemoteActivities();

    await ensureLoaded(redmineConfig, '10');
    await ensureLoaded(redmineConfig, '11');

    expect(getActivityOptionsMock).toHaveBeenCalledTimes(1);
    expect(stateFor(redmineConfig, '10').options).toEqual([{ id: 'a1', name: 'Development' }]);
    expect(stateFor(redmineConfig, '11').options).toEqual([{ id: 'a1', name: 'Development' }]);
  });

  it('keeps a distinct scope per issue for a work-package-dependent provider', async () => {
    getActivityOptionsMock
      .mockResolvedValueOnce([{ id: 'a1', name: 'Development' }])
      .mockResolvedValueOnce([{ id: 'a2', name: 'Support' }]);
    const { ensureLoaded, stateFor } = useRemoteActivities();

    await ensureLoaded(config, '10');
    await ensureLoaded(config, '11');

    expect(getActivityOptionsMock).toHaveBeenCalledTimes(2);
    expect(stateFor(config, '10').options).toEqual([{ id: 'a1', name: 'Development' }]);
    expect(stateFor(config, '11').options).toEqual([{ id: 'a2', name: 'Support' }]);
  });

  it('preserves extension failures for linked activity UI and clears them on recheck', async () => {
    getActivityOptionsMock
      .mockRejectedValueOnce(
        new ExtensionProtocolError('permission', 'error.extensionDestinationUnapproved'),
      )
      .mockResolvedValueOnce([{ id: 'a1', name: 'Development' }]);
    const { ensureLoaded, retry, stateFor } = useRemoteActivities();
    const extensionConfig = { ...config, directBrowserAccess: false };
    await ensureLoaded(extensionConfig, '42');
    expect(stateFor(config, '42').errorKey).toBe('error.extensionDestinationUnapproved');
    await retry(extensionConfig, '42');
    expect(stateFor(config, '42')).toMatchObject({
      errorKey: null,
      loading: false,
      loaded: true,
    });
  });
});
