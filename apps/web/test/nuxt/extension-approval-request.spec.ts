import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ExtensionStatusFooter from '../../app/components/ExtensionStatusFooter.vue';
import SyncDayRow from '../../app/components/sync/SyncDayRow.vue';
import SyncRowDetail from '../../app/components/sync/SyncRowDetail.vue';
import type { DestinationSelector } from '@osi/extension-protocol';
import {
  suggestionKey,
  type ExtensionSuggestionState,
} from '../../app/composables/use-extension-suggestion';
import type { ExtensionReadinessSnapshot } from '../../app/utils/remote/extension-readiness';
import type { ExtensionSuggestionOutcome } from '../../app/utils/remote/extension-suggestion';

interface FakeSuggestionState {
  snapshot: ExtensionReadinessSnapshot;
  recheck: ReturnType<typeof vi.fn>;
  outcome: ExtensionSuggestionOutcome;
  suggested: DestinationSelector[];
}

const state = vi.hoisted((): FakeSuggestionState => {
  const snapshot: ExtensionReadinessSnapshot = {
    connection: 'ready',
    messageKey: 'layout.extensionStatus.partial',
    aggregate: 'orange',
    trackers: [],
  };
  const outcome: ExtensionSuggestionOutcome = { status: 'queued' };
  const suggested: DestinationSelector[] = [];
  return { snapshot, recheck: vi.fn(), outcome, suggested };
});

mockNuxtImport('useExtensionReadiness', () => () => ({
  snapshot: computed(() => state.snapshot),
  aggregate: computed(() => state.snapshot.aggregate),
  recheck: state.recheck,
}));

// The composable's own behavior is unit-tested; here it records requests and replays an outcome.
mockNuxtImport('useExtensionSuggestion', () => (onAlreadyApproved: () => void) => {
  const states = ref<Record<string, ExtensionSuggestionState>>({});
  return {
    states,
    request: async (destination: DestinationSelector) => {
      state.suggested.push(destination);
      if (state.outcome.status === 'alreadyApproved') {
        onAlreadyApproved();
        return;
      }
      states.value = { ...states.value, [suggestionKey(destination)]: state.outcome };
    },
  };
});

mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const stubs = {
  UPopover: { template: '<div><slot /><slot name="content" /></div>' },
  UTooltip: { template: '<span><slot /></span>' },
};

const unapprovedTracker = {
  id: 'req',
  name: 'Required Tracker',
  systemType: 'redmine' as const,
  baseUrl: 'https://rm.example.com',
  directBrowserAccess: false,
  destinationApproved: false,
};

describe('request approval in the extension', () => {
  beforeEach(() => {
    state.recheck.mockReset();
    state.suggested = [];
    state.outcome = { status: 'queued' };
    state.snapshot = { ...state.snapshot, connection: 'ready', trackers: [unapprovedTracker] };
  });

  it('asks the extension for an unapproved required tracker and says where to finish', async () => {
    const wrapper = await mountSuspended(ExtensionStatusFooter, { global: { stubs } });
    await wrapper.get('[data-testid="extension-status-request-req"]').trigger('click');
    await flushPromises();
    expect(state.suggested).toEqual([{ provider: 'redmine', baseUrl: 'https://rm.example.com' }]);
    expect(wrapper.get('[data-testid="extension-status-request-req-queued"]').text()).toBe(
      'layout.extensionStatus.requestSent',
    );
  });

  it('rechecks readiness when the extension already has the tracker approved', async () => {
    state.outcome = { status: 'alreadyApproved' };
    const wrapper = await mountSuspended(ExtensionStatusFooter, { global: { stubs } });
    await wrapper.get('[data-testid="extension-status-request-req"]').trigger('click');
    await flushPromises();
    expect(state.recheck).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="extension-status-request-req-queued"]').exists()).toBe(
      false,
    );
  });

  it('shows the translated rejection and keeps the tracker unapproved', async () => {
    state.outcome = { status: 'failed', messageKey: 'error.extensionLimitExceeded' };
    const wrapper = await mountSuspended(ExtensionStatusFooter, { global: { stubs } });
    await wrapper.get('[data-testid="extension-status-request-req"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="extension-status-request-req-error"]').text()).toBe(
      'error.extensionLimitExceeded',
    );
    expect(wrapper.text()).toContain('layout.extensionStatus.destinationUnapproved');
  });

  it.each(['unavailable', 'incompatible', 'websiteUnapproved'] as const)(
    'offers no request while the extension is %s',
    async (connection) => {
      state.snapshot = { ...state.snapshot, connection };
      const wrapper = await mountSuspended(ExtensionStatusFooter, { global: { stubs } });
      expect(wrapper.find('[data-testid="extension-status-request-req"]').exists()).toBe(false);
    },
  );

  it('offers the request next to recheck when sync fails on an unapproved tracker', async () => {
    const wrapper = await mountSuspended(SyncRowDetail, {
      props: {
        taskId: 'task',
        entries: [],
        showRemoteLogs: true,
        remoteLogs: [],
        remoteLogsLoading: false,
        remoteLogsErrorKey: 'error.extensionDestinationUnapproved',
        remoteLogsLoaded: true,
        exportRecords: [],
        trackerId: 'cfg',
        trackerDestination: { provider: 'redmine', baseUrl: 'https://rm.example.com' },
        canReconcile: false,
        busy: false,
        formatEntryStart: (iso: string) => iso,
        formatEntryStop: (iso: string) => iso,
      },
      global: { stubs },
    });
    expect(wrapper.find('[data-testid="remote-sync-remote-logs-retry-task"]').exists()).toBe(true);
    await wrapper.get('[data-testid="remote-sync-remote-logs-request-task"]').trigger('click');
    await flushPromises();
    expect(state.suggested).toEqual([{ provider: 'redmine', baseUrl: 'https://rm.example.com' }]);

    await wrapper.setProps({ remoteLogsErrorKey: 'error.extensionIncompatible' });
    expect(wrapper.find('[data-testid="remote-sync-remote-logs-request-task"]').exists()).toBe(
      false,
    );
  });

  it('offers the request on a day row whose activity fetch hit an unapproved tracker', async () => {
    const config = {
      id: 'cfg',
      name: '',
      systemType: 'redmine' as const,
      baseUrl: 'https://rm.example.com',
      directBrowserAccess: false,
      roundingRule: 'none' as const,
      createdAt: '',
      updatedAt: '',
    };
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
        kindColor: 'warning',
        reason: '',
        issueTitle: 'Linked',
        issueId: '42',
        showLinkPicker: false,
        pickerConfig: config,
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
      global: { stubs },
    });
    await wrapper.get('[data-testid="remote-sync-activity-request-task"]').trigger('click');
    await flushPromises();
    expect(state.suggested).toEqual([{ provider: 'redmine', baseUrl: 'https://rm.example.com' }]);
    expect(wrapper.find('[data-testid="remote-sync-activity-request-task-queued"]').exists()).toBe(
      true,
    );
  });
});
