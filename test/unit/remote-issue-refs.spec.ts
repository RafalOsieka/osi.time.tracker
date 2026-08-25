import { describe, expect, it } from 'vitest';
import { taskRowToRemoteIssueRefDto } from '../../server/utils/remote-issue-refs';

const linkedRow = {
  id: 'task-1',
  userId: 'user-1',
  trackerId: 'tracker-1',
  remoteIssueId: '42',
  remoteIssueCachedTitle: 'Fix login',
  // SAFETY: Assertion documents a typed boundary the compiler cannot prove.
  remoteIssueCachedProjectTitle: null as string | null,
  remoteIssueCreatedAt: new Date('2026-03-01T10:00:00.000Z'),
  remoteIssueUpdatedAt: new Date('2026-03-01T10:00:00.000Z'),
};

const activeTracker = {
  baseUrl: 'https://op.example.com',
  systemType: 'openproject',
  deletedAt: null,
};

describe('taskRowToRemoteIssueRefDto', () => {
  it('exposes a cached remote project title when present', () => {
    const dto = taskRowToRemoteIssueRefDto(
      { ...linkedRow, remoteIssueCachedProjectTitle: '  Acme Intranet  ' },
      activeTracker,
    );
    expect(dto?.cachedRemoteProjectTitle).toBe('Acme Intranet');
    expect(dto?.cachedTitle).toBe('Fix login');
  });

  it('omits a null or blank cached remote project title', () => {
    expect(taskRowToRemoteIssueRefDto(linkedRow, activeTracker)?.cachedRemoteProjectTitle).toBe(
      undefined,
    );
    expect(
      taskRowToRemoteIssueRefDto(
        { ...linkedRow, remoteIssueCachedProjectTitle: '   ' },
        activeTracker,
      )?.cachedRemoteProjectTitle,
    ).toBeUndefined();
  });
});
