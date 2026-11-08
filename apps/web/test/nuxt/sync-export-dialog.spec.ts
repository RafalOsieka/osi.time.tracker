import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import SyncExportDialog, {
  type ExportDialogIncludedRow,
} from '../../app/components/sync/SyncExportDialog.vue';

function item(
  taskId: string,
  comment: string,
  toSendSeconds: number,
  destination: Partial<ExportDialogIncludedRow> = {},
): ExportDialogIncludedRow {
  return {
    taskId,
    comment,
    toSendSeconds,
    trackerName: null,
    issueId: null,
    activityName: null,
    ...destination,
  };
}

describe('SyncExportDialog', () => {
  it('lists comments, durations, destinations and the batch total', async () => {
    const wrapper = await mountSuspended(SyncExportDialog, {
      props: {
        open: true,
        dateLabel: 'November 7, 2026',
        included: [
          item('a', 'Override for Alpha', 1800, {
            trackerName: 'Acme OpenProject',
            issueId: '4821',
            activityName: 'Development',
          }),
          item('b', 'Beta', 900),
        ],
        toSendSeconds: 2700,
        isRunning: false,
        completedCount: 0,
        totalCount: 2,
      },
      global: {
        stubs: { UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' } },
      },
    });
    expect(wrapper.get('[data-testid="remote-sync-export-intro"]').text()).toContain(
      'Time export for November 7, 2026',
    );
    expect(wrapper.get('[data-testid="remote-sync-export-row-a"]').text()).toContain(
      'Override for Alpha',
    );
    expect(wrapper.get('[data-testid="remote-sync-export-row-a"]').text()).toContain('00:30:00');
    expect(wrapper.get('[data-testid="remote-sync-export-destination-a"]').text()).toBe(
      'Acme OpenProject · #4821 · Development',
    );
    expect(wrapper.find('[data-testid="remote-sync-export-destination-b"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="remote-sync-export-dialog-to-send"]').text()).toContain(
      '00:45:00',
    );
    expect(wrapper.find('[data-testid="remote-sync-export-not-ready"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="remote-sync-export-confirm"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('counts the tasks that are not ready without listing them (REQ-229)', async () => {
    const wrapper = await mountSuspended(SyncExportDialog, {
      props: {
        open: true,
        dateLabel: 'November 7, 2026',
        included: [item('a', 'Alpha', 1800)],
        toSendSeconds: 1800,
        notReadyCount: 3,
        isRunning: false,
        completedCount: 0,
        totalCount: 1,
      },
      global: {
        stubs: { UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' } },
      },
    });
    expect(wrapper.get('[data-testid="remote-sync-export-not-ready"]').text()).toBe(
      '3 other tasks of this day are not ready to export: they have no activity chosen or cannot be sent.',
    );
    expect(wrapper.findAll('[data-testid^="remote-sync-export-row-"]')).toHaveLength(1);
    // One Task: its row already shows the duration, so no separate total repeats it.
    expect(wrapper.find('[data-testid="remote-sync-export-dialog-to-send"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps footer actions while running, with confirm loading and cancel disabled', async () => {
    const wrapper = await mountSuspended(SyncExportDialog, {
      props: {
        open: true,
        dateLabel: 'November 7, 2026',
        included: [item('a', 'Alpha', 1800)],
        toSendSeconds: 1800,
        isRunning: true,
        completedCount: 0,
        totalCount: 1,
      },
      global: {
        stubs: {
          UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
          UButton: {
            props: ['label', 'loading', 'disabled'],
            emits: ['click'],
            template:
              '<button v-bind="$attrs" :disabled="disabled || loading" :data-loading="loading ? \'true\' : undefined" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="remote-sync-export-progress"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-testid="remote-sync-export-confirm"]').attributes('data-loading'),
    ).toBe('true');
    expect(
      wrapper.get('[data-testid="remote-sync-export-cancel"]').attributes('disabled'),
    ).toBeDefined();
    wrapper.unmount();
  });
});
