import { describe, expect, it } from 'vitest';
import type {
  RemoteAccount,
  RemoteFieldOption,
  RemoteIssueLookup,
  RemoteIssueScope,
  RemoteIssueSearchResult,
  RemoteProjectDto,
  RemoteTimeEntryDeleteOutcome,
  RemoteTimeLogDto,
  RemoteTrackerAdapter,
} from '@osi/remote-trackers/contracts';

class ContractProbeAdapter implements RemoteTrackerAdapter {
  async searchIssues(
    _query: string,
    _scope?: RemoteIssueScope,
  ): Promise<RemoteIssueSearchResult[]> {
    return [];
  }

  async getIssueById(
    _remoteIssueId: string,
    _scope?: RemoteIssueScope,
  ): Promise<RemoteIssueLookup | null> {
    return null;
  }

  async listProjects(): Promise<RemoteProjectDto[]> {
    return [];
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

  async deleteTimeEntry(_remoteLogId: string): Promise<RemoteTimeEntryDeleteOutcome> {
    return { status: 'deleted' };
  }
}

describe('RemoteTrackerAdapter contract', () => {
  it('exposes the nine provider-neutral operations', async () => {
    const adapter: RemoteTrackerAdapter = new ContractProbeAdapter();
    expect(await adapter.searchIssues('q')).toEqual([]);
    expect(await adapter.searchIssues('q', { remoteProjectId: '1' })).toEqual([]);
    expect(await adapter.getIssueById('1')).toBeNull();
    expect(await adapter.getIssueById('1', { remoteProjectId: '1' })).toBeNull();
    expect(await adapter.listProjects()).toEqual([]);
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
    expect(await adapter.deleteTimeEntry('log-1')).toEqual({ status: 'deleted' });
  });

  it('returns inScope: true for an unscoped lookup', async () => {
    class FoundAdapter extends ContractProbeAdapter {
      override async getIssueById(
        remoteIssueId: string,
        scope?: RemoteIssueScope,
      ): Promise<RemoteIssueLookup | null> {
        return { result: { remoteIssueId, title: 'Found' }, inScope: !scope };
      }
    }
    const adapter: RemoteTrackerAdapter = new FoundAdapter();

    await expect(adapter.getIssueById('1')).resolves.toEqual({
      result: { remoteIssueId: '1', title: 'Found' },
      inScope: true,
    });
    await expect(adapter.getIssueById('1', { remoteProjectId: '9' })).resolves.toEqual({
      result: { remoteIssueId: '1', title: 'Found' },
      inScope: false,
    });
  });
});
