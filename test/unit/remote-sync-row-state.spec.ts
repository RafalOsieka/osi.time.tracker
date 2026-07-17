import { describe, expect, it } from 'vitest';
import { deriveRemoteSyncRowState } from '../../shared/utils/remote-sync-row-state';

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

  it('returns system_not_implemented for an unsupported system type', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: { systemType: 'redmine' },
        hasIssueRef: false,
      }),
    ).toBe('system_not_implemented');
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

  it('gives no_client precedence over every other missing prerequisite', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: false,
        hasClient: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
      }),
    ).toBe('no_client');
  });

  it('gives no_config precedence over system_not_implemented and unlinked', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasClient: true,
        config: null,
        hasIssueRef: true,
      }),
    ).toBe('no_config');
  });
});
