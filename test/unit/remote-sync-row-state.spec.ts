import { describe, expect, it } from 'vitest';
import {
  deriveRemoteSyncRowState,
  isImplementedTrackerSystemType,
} from '../../shared/utils/remote-sync-row-state';

describe('isImplementedTrackerSystemType', () => {
  it('accepts openproject and redmine', () => {
    expect(isImplementedTrackerSystemType('openproject')).toBe(true);
    expect(isImplementedTrackerSystemType('redmine')).toBe(true);
  });

  it('rejects unknown system types', () => {
    expect(isImplementedTrackerSystemType('jira')).toBe(false);
  });
});

describe('deriveRemoteSyncRowState', () => {
  it('returns no_project when the Task has no Project', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: false,
        hasTracker: false,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_project');
  });

  it('returns no_tracker when the Project has no active tracker', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: false,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_tracker');
  });

  it('returns no_tracker when tracker is present but config surface is missing', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: null,
        hasIssueRef: false,
      }),
    ).toBe('no_tracker');
  });

  it('returns unlinked for a Redmine tracker without an issue ref', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'redmine' },
        hasIssueRef: false,
      }),
    ).toBe('unlinked');
  });

  it('returns unlinked when the tracker is usable but there is no issue ref', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: false,
      }),
    ).toBe('unlinked');
  });

  it('returns sent when the task/date already has finalized exports', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        hasExports: true,
      }),
    ).toBe('sent');
  });

  it('keeps a sent row sent even when later local time exists', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        hasExports: true,
        activityStatus: 'available',
      }),
    ).toBe('sent');
  });

  it('returns manageable when all prerequisites are met', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
      }),
    ).toBe('manageable');
  });

  it('returns activity_loading while activities are in flight', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
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
        hasTracker: true,
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
        hasTracker: true,
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
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'error',
      }),
    ).not.toBe('no_activity');
  });

  it('gives no_project precedence over activity outcomes', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: false,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: true,
        activityStatus: 'available',
      }),
    ).toBe('no_project');
  });

  it('gives unlinked precedence over activity outcomes', () => {
    expect(
      deriveRemoteSyncRowState({
        hasProject: true,
        hasTracker: true,
        config: { systemType: 'openproject' },
        hasIssueRef: false,
        activityStatus: 'empty',
      }),
    ).toBe('unlinked');
  });
});
