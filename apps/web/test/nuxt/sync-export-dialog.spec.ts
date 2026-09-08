import { describe, expect, it, vi } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import SyncExportDialog from '../../app/components/sync/SyncExportDialog.vue';

describe('SyncExportDialog uncertainty', () => {
  it.each([
    {
      locale: 'en' as const,
      unknown: 'Retrying may create a duplicate.',
      known: 'Retry finalizes the same export',
    },
    {
      locale: 'pl' as const,
      unknown: 'Ponowienie może utworzyć duplikat.',
      known: 'Ponowienie finalizuje ten sam eksport',
    },
  ])(
    'distinguishes unknown creation from known-ID finalization in $locale',
    async ({ locale, unknown, known }) => {
      const wrapper = await mountSuspended(SyncExportDialog, {
        props: {
          open: true,
          phase: 'report',
          skipped: [],
          dayTotalSeconds: 3600,
          trackedSeconds: 3600,
          toSendSeconds: 3600,
          completedCount: 1,
          totalCount: 1,
          isRunning: false,
          progress: { task: 'uncertain' },
          outcomes: {
            task: {
              taskId: 'task',
              status: 'remote_failure',
              messageKey: 'error.extensionUnknownCreate',
            },
          },
          included: [
            {
              taskId: 'task',
              taskName: 'Task',
              issueLabel: '42',
              activityLabel: 'Development',
              trackedSeconds: 3600,
              toSendSeconds: 3600,
              comment: '',
              isRepeat: false,
              isDuplicate: false,
              baseUrl: 'https://tracker.example',
              row: {
                taskId: 'task',
                taskName: 'Task',
                projectName: 'Project',
                trackerName: 'Tracker',
                totalSeconds: 3600,
                entries: [],
                exports: [],
                config: null,
                issueRef: null,
              },
            },
          ],
        },
        global: {
          stubs: { UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' } },
        },
      });
      await wrapper.vm.$nextTick();
      await useNuxtApp().$i18n.setLocale(locale);
      await wrapper.vm.$nextTick();
      const result = wrapper.get('[data-testid="remote-sync-export-result-task"]');
      expect(result.text()).toContain(unknown);
      expect(result.text()).not.toContain(known);
      expect(wrapper.find('[data-testid="remote-sync-export-log-link-task"]').exists()).toBe(false);
      await wrapper.get('[data-testid="remote-sync-export-retry-task"]').trigger('click');
      expect(wrapper.emitted('retry')).toEqual([['task']]);
      const input = wrapper.get('[data-testid="remote-sync-existing-log-id"]');
      expect(
        wrapper.get('[data-testid="remote-sync-existing-log-submit"]').attributes('disabled'),
      ).toBeDefined();
      await input.setValue('9001');
      await wrapper.setProps({ isRunning: true });
      expect(input.attributes('disabled')).toBeDefined();
      expect(
        wrapper.get('[data-testid="remote-sync-existing-log-submit"]').attributes('disabled'),
      ).toBeDefined();
      await wrapper.setProps({ isRunning: false });
      await wrapper.get('[data-testid="remote-sync-existing-log-form"]').trigger('submit');
      await vi.waitFor(() => expect(wrapper.emitted('reconcile')).toEqual([['task', '9001']]));
      await wrapper.setProps({
        outcomes: {
          task: { taskId: 'task', status: 'uncertain_finalization', remoteLogId: '9001' },
        },
      });
      expect(result.text()).toContain(known);
      expect(result.text()).not.toContain(unknown);
      expect(wrapper.find('[data-testid="remote-sync-existing-log-form"]').exists()).toBe(false);
      expect(
        wrapper.get('[data-testid="remote-sync-export-log-link-task"]').attributes('href'),
      ).toBe('https://tracker.example/time_entries/9001');
      wrapper.unmount();
    },
  );
});
