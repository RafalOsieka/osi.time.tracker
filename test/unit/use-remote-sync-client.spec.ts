import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';
import type { TrackerDto } from '../../shared/types/tracker';
import type { RemoteTimeLogDto } from '../../shared/types/remote-export';

const getCurrentAccount = vi.fn();
const fetchTimeLogs = vi.fn();
const createTimeEntry = vi.fn();
const getSecret = vi.fn(() => 'secret');

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: () => ({
    getCurrentAccount,
    fetchTimeLogs,
    createTimeEntry,
  }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/useTrackerSecret', () => ({
  useTrackerSecret: () => ({
    get: getSecret,
    set: vi.fn(),
    clear: vi.fn(),
  }),
}));

const { mapRemoteSyncClientError, useRemoteSyncClient } =
  await import('../../app/composables/useRemoteSyncClient');

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

function log(overrides: Partial<RemoteTimeLogDto> = {}): RemoteTimeLogDto {
  return {
    remoteLogId: '11',
    remoteIssueId: '42',
    spentOn: '2026-03-15',
    durationSeconds: 3600,
    activityId: '1',
    activityName: 'Dev',
    comment: null,
    remoteUserId: '7',
    ...overrides,
  };
}

describe('useRemoteSyncClient', () => {
  beforeEach(() => {
    getCurrentAccount.mockReset();
    fetchTimeLogs.mockReset();
    createTimeEntry.mockReset();
    getSecret.mockClear();
    getCurrentAccount.mockResolvedValue({ id: '7', name: 'Ada' });
    fetchTimeLogs.mockResolvedValue([log()]);
    createTimeEntry.mockResolvedValue({ remoteLogId: '99' });
  });

  it('reuses the cached account on a second resolveAccount call', async () => {
    const client = useRemoteSyncClient(config);
    await expect(client.resolveAccount()).resolves.toEqual({ id: '7', name: 'Ada' });
    await expect(client.resolveAccount()).resolves.toEqual({ id: '7', name: 'Ada' });
    expect(getCurrentAccount).toHaveBeenCalledTimes(1);
  });

  it('coalesces in-flight account lookups', async () => {
    let release!: (value: { id: string; name: string }) => void;
    getCurrentAccount.mockImplementation(
      () =>
        new Promise<{ id: string; name: string }>((resolve) => {
          release = resolve;
        }),
    );
    const client = useRemoteSyncClient(config);
    const first = client.resolveAccount();
    const second = client.resolveAccount();
    expect(getCurrentAccount).toHaveBeenCalledTimes(1);
    release({ id: '7', name: 'Ada' });
    await expect(first).resolves.toEqual({ id: '7', name: 'Ada' });
    await expect(second).resolves.toEqual({ id: '7', name: 'Ada' });
  });

  it('returns cached time logs on a second fetch with the same key', async () => {
    const client = useRemoteSyncClient(config);
    const input = { spentOn: '2026-03-15', workPackageIds: ['42'] };
    const first = await client.fetchTimeLogs(input);
    const second = await client.fetchTimeLogs(input);
    expect(first).toEqual([log()]);
    expect(second).toBe(first);
    expect(fetchTimeLogs).toHaveBeenCalledTimes(1);
  });

  it('invalidates caches so the next fetch hits the adapter again', async () => {
    const client = useRemoteSyncClient(config);
    await client.resolveAccount();
    await client.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] });
    client.invalidateCaches();
    await client.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] });
    expect(getCurrentAccount).toHaveBeenCalledTimes(2);
    expect(fetchTimeLogs).toHaveBeenCalledTimes(2);
  });

  it('creates a remote time entry through the adapter', async () => {
    const client = useRemoteSyncClient(config);
    await expect(
      client.createTimeEntry({
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
        comment: 'ship it',
      }),
    ).resolves.toEqual({ remoteLogId: '99' });
    expect(createTimeEntry).toHaveBeenCalledWith({
      remoteIssueId: '42',
      spentOn: '2026-03-15',
      durationSeconds: 1800,
      activityId: '1',
      comment: 'ship it',
    });
  });

  it('maps adapter errors to translation keys', () => {
    expect(mapRemoteSyncClientError(new RemoteAdapterError('error.remoteAuth'), 'fallback')).toBe(
      'error.remoteAuth',
    );
    expect(mapRemoteSyncClientError(new Error('nope'), 'fallback')).toBe('fallback');
  });
});
