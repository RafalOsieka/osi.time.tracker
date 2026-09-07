import { describe, expect, it } from 'vitest';
import type {
  RemoteAccount,
  RemoteFieldOption,
  RemoteIssueSearchResult,
  RemoteTimeLogDto,
  RemoteTrackerAdapter,
} from '@osi/remote-trackers/contracts';

class ContractProbeAdapter implements RemoteTrackerAdapter {
  async searchIssues(_query: string): Promise<RemoteIssueSearchResult[]> {
    return [];
  }

  async getIssueById(_remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    return null;
  }

  async getActivityOptions(_remoteIssueId: string): Promise<RemoteFieldOption[]> {
    return [];
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    return { id: '1', name: 'Ada' };
  }

  async fetchTimeLogs(_input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    return [];
  }

  async fetchTimeLogsInRange(_input: {
    from: string;
    to: string;
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    return [];
  }

  async createTimeEntry(_input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    return { remoteLogId: 'log-1' };
  }
}

describe('RemoteTrackerAdapter contract', () => {
  it('exposes the seven provider-neutral operations', async () => {
    const adapter: RemoteTrackerAdapter = new ContractProbeAdapter();
    expect(await adapter.searchIssues('q')).toEqual([]);
    expect(await adapter.getIssueById('1')).toBeNull();
    expect(await adapter.getActivityOptions('1')).toEqual([]);
    expect(await adapter.getCurrentAccount()).toEqual({ id: '1', name: 'Ada' });
    expect(await adapter.fetchTimeLogs({ spentOn: '2026-01-01', workPackageIds: ['1'] })).toEqual(
      [],
    );
    expect(await adapter.fetchTimeLogsInRange({ from: '2026-01-01', to: '2026-01-31' })).toEqual(
      [],
    );
    expect(
      await adapter.createTimeEntry({
        remoteIssueId: '1',
        spentOn: '2026-01-01',
        durationSeconds: 3600,
        activityId: '2',
      }),
    ).toEqual({ remoteLogId: 'log-1' });
  });
});
