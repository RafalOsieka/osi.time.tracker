import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useRemoteDayLogs } from '../../app/composables/use-remote-day-logs';
import type { TrackerDto } from '../../shared/types/tracker';

const fetchTimeLogsMock = vi.fn();
const invalidateCachesMock = vi.fn();

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/composables/use-remote-sync-client', () => ({
  useRemoteSyncClient: () => ({
    fetchTimeLogs: fetchTimeLogsMock,
    invalidateCaches: invalidateCachesMock,
    createTimeEntry: vi.fn(),
    resolveAccount: vi.fn(),
  }),
  mapRemoteSyncClientError: (_err: Error, fallback: string) => fallback,
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

describe('useRemoteDayLogs', () => {
  beforeEach(() => {
    fetchTimeLogsMock.mockReset();
    invalidateCachesMock.mockReset();
  });

  it('loads same-day logs and filters by issue id', async () => {
    fetchTimeLogsMock.mockResolvedValue([
      {
        remoteLogId: '1',
        remoteIssueId: '10',
        spentOn: '2026-03-15',
        durationSeconds: 3600,
        activityName: 'Dev',
      },
      {
        remoteLogId: '2',
        remoteIssueId: '11',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityName: 'QA',
      },
    ]);
    const date = ref('2026-03-15');
    const { ensureLoaded, logsFor } = useRemoteDayLogs(date);

    await ensureLoaded(config, ['10', '11']);
    const forTen = logsFor(config.id, '10');
    expect(forTen.loaded).toBe(true);
    expect(forTen.logs).toHaveLength(1);
    expect(forTen.logs[0]?.remoteLogId).toBe('1');
  });

  it('surfaces errors and retries after invalidating caches', async () => {
    fetchTimeLogsMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);
    const date = ref('2026-03-15');
    const { ensureLoaded, retry, logsFor } = useRemoteDayLogs(date);

    await ensureLoaded(config, ['10']);
    expect(logsFor(config.id, '10').errorKey).toBe('error.remoteTimeLogsFetchFailed');

    await retry(config, ['10']);
    expect(invalidateCachesMock).toHaveBeenCalledTimes(1);
    expect(logsFor(config.id, '10').errorKey).toBeNull();
    expect(logsFor(config.id, '10').loaded).toBe(true);
  });
});
