import { describe, expect, it } from 'vitest';
import {
  deriveRemoteSyncRowState,
  isImplementedRemoteSystemType,
} from '../../shared/utils/remote-sync-row-state';

describe('isImplementedRemoteSystemType', () => {
  it('accepts openproject and redmine', () => {
    expect(isImplementedRemoteSystemType('openproject')).toBe(true);
    expect(isImplementedRemoteSystemType('redmine')).toBe(true);
  });

  it('rejects unknown system types', () => {
    expect(isImplementedRemoteSystemType('jira')).toBe(false);
  });
});

describe('deriveRemoteSyncRowState', () => {
  it('returns no_client when the Task has no Project', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: false,
        hasClient: false,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_client');
  });

  it('returns no_client when the Project has no resolvable Client', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: false,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_client');
  });

  it('returns no_config when the Client has no remote configuration', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_config');
  });

  it('returns unlinked for a Redmine configuration without an issue ref', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'redmine' },
        hasIssueRef: false,
      }),
    ).toBe('unlinked');
  });

  it('returns unlinked when the configuration is usable but there is no issue ref', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: false,
      }),
    ).toBe('unlinked');
  });

  it('returns manageable when all prerequisites are met', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
      }),
    ).toBe('manageable');
  });

  it('returns activity_loading while activities are in flight', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'loading',
      }),
    ).toBe('activity_loading');
  });

  it('returns activity_error for a retryable transport failure', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'error',
      }),
    ).toBe('activity_error');
  });

  it('returns no_activity for a successful empty activity response', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'empty',
      }),
    ).toBe('no_activity');
  });

  it('does not convert transport failure into no_activity', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'error',
      }),
    ).not.toBe('no_activity');
  });

  it('gives no_client precedence over activity outcomes', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: false,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'available',
      }),
    ).toBe('no_client');
  });

  it('gives unlinked precedence over activity outcomes', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: false,
        activityStatus: 'empty',
      }),
    ).toBe('unlinked');
  });
});
