import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import SyncExportDialog from '../../app/components/sync/SyncExportDialog.vue';

describe('SyncExportDialog', () => {
  it('lists comments, durations, and the batch total', async () => {
    const wrapper = await mountSuspended(SyncExportDialog, {
      props: {
        open: true,
        included: [
          { taskId: 'a', comment: 'Override for Alpha', toSendSeconds: 1800 },
          { taskId: 'b', comment: 'Beta', toSendSeconds: 900 },
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
    expect(wrapper.get('[data-testid="remote-sync-export-row-a"]').text()).toContain(
      'Override for Alpha',
    );
    expect(wrapper.get('[data-testid="remote-sync-export-row-a"]').text()).toContain('00:30:00');
    expect(wrapper.get('[data-testid="remote-sync-export-dialog-to-send"]').text()).toContain(
      '00:45:00',
    );
    expect(wrapper.find('[data-testid="remote-sync-export-confirm"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('keeps footer actions while running, with confirm loading and cancel disabled', async () => {
    const wrapper = await mountSuspended(SyncExportDialog, {
      props: {
        open: true,
        included: [{ taskId: 'a', comment: 'Alpha', toSendSeconds: 1800 }],
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
