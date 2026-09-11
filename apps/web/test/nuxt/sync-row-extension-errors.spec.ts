import { describe, expect, it } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import SyncDayRow from '../../app/components/sync/SyncDayRow.vue';
import SyncRowDetail from '../../app/components/sync/SyncRowDetail.vue';

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }));

function globalOptions() {
  return { stubs: { UTooltip: { template: '<span><slot /></span>' } } };
}

describe('sync row extension errors', () => {
  it('shows the actual activity failure and setup/recheck guidance for an already linked task', async () => {
    const wrapper = await mountSuspended(SyncDayRow, {
      props: {
        row: {
          taskId: 'task',
          taskName: 'Task',
          projectName: 'Project',
          trackerName: 'Tracker',
          remoteProjectId: null,
          remoteProjectTitle: null,
          totalSeconds: 60,
          config: null,
          issueRef: { remoteIssueId: '42', cachedTitle: 'Linked' },
          entries: [],
          exports: [],
        },
        expanded: false,
        canEdit: false,
        showEditors: false,
        kindLabel: null,
        kindColor: 'error',
        reason: '',
        issueTitle: 'Linked',
        issueId: '42',
        showLinkPicker: false,
        pickerConfig: null,
        comment: '',
        editingTitle: false,
        trackedLabel: '1m',
        toSendLabel: '1m',
        deltaLabel: '0m',
        editingToSend: false,
        toSendInput: '',
        activityLoading: false,
        activityError: true,
        activityErrorKey: 'error.extensionDestinationUnapproved',
        activityOptions: [],
        selectedActivityId: undefined,
        noActivity: false,
      },
      global: globalOptions(),
    });
    expect(wrapper.get('[data-testid="remote-sync-activity-error-task"]').text()).toBe(
      'error.extensionDestinationUnapproved',
    );
    expect(wrapper.text()).toContain('trackers.extensionSetupGuidance');
    await wrapper.get('[data-testid="remote-sync-activity-retry-task"]').trigger('click');
    expect(wrapper.emitted('retry-activity')).toHaveLength(1);
    await wrapper.setProps({ activityErrorKey: 'error.extensionUntrustedSecret' });
    expect(wrapper.text()).not.toContain('extensionUntrustedSecret');
    expect(wrapper.get('[data-testid="remote-sync-activity-error-task"]').text()).toBe(
      'remoteSync.activityFetchError',
    );
    wrapper.unmount();
  });

  it('shows safe log failures with setup/recheck guidance and keeps unknown errors generic', async () => {
    const wrapper = await mountSuspended(SyncRowDetail, {
      props: {
        taskId: 'task',
        entries: [],
        showRemoteLogs: true,
        remoteLogs: [],
        remoteLogsLoading: false,
        remoteLogsErrorKey: 'error.extensionIncompatible',
        remoteLogsLoaded: true,
        exportRecords: [],
        trackerId: 'cfg',
        canReconcile: true,
        busy: false,
        formatEntryStart: (iso) => iso,
        formatEntryStop: (iso) => iso,
      },
      global: globalOptions(),
    });
    expect(wrapper.get('[data-testid="remote-sync-remote-logs-error-task"]').text()).toBe(
      'error.extensionIncompatible',
    );
    expect(wrapper.text()).toContain('trackers.extensionSetupGuidance');
    expect(wrapper.get('[data-testid="remote-sync-remote-logs-retry-task"]').text()).toBe(
      'trackers.extensionRecheckButton',
    );
    await wrapper.get('[data-testid="remote-sync-remote-logs-retry-task"]').trigger('click');
    expect(wrapper.emitted('retryRemoteLogs')).toHaveLength(1);
    await wrapper.setProps({ remoteLogsErrorKey: 'error.extensionUntrustedSecret' });
    expect(wrapper.text()).not.toContain('extensionUntrustedSecret');
    expect(wrapper.get('[data-testid="remote-sync-remote-logs-error-task"]').text()).toBe(
      'remoteSync.remoteLogsError',
    );
    wrapper.unmount();
  });
});
