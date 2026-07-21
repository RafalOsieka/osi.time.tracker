import { describe, expect, it, vi } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import ConfirmModal from '../../app/components/ConfirmModal.vue';

const confirmMock = vi.fn(async (_options?: unknown) => true);

vi.mock('../../app/composables/useAppConfirm', () => ({
  useAppConfirm: () => confirmMock,
}));

describe('REQ-129: shared confirm overlay', () => {
  it('renders ConfirmModal accept/reject actions', async () => {
    const wrapper = await mountSuspended(ConfirmModal, {
      props: {
        title: 'Delete client',
        description: 'Are you sure?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
      },
      global: {
        stubs: {
          UModal: {
            template: '<div data-testid="confirm-modal"><slot name="footer" /></div>',
          },
          UButton: {
            props: ['label'],
            emits: ['click'],
            template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="confirm-accept"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="confirm-reject"]').exists()).toBe(true);
  });

  it('resolves confirmation through the shared helper', async () => {
    const confirmed = await confirmMock({
      title: 'Delete client',
      description: 'Are you sure?',
    });
    expect(confirmed).toBe(true);
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete client' }));
  });
});
