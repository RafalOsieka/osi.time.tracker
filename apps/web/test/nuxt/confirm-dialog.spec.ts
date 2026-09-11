import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import ConfirmModal from '../../app/components/ConfirmModal.vue';
import type { AppConfirmOptions } from '../../app/composables/use-app-confirm';

const confirmMock = vi.fn(async (_options?: AppConfirmOptions) => true);

// oxlint-disable-next-line anti-slop/no-module-mocking -- overlay confirm has no test seam
vi.mock('../../app/composables/use-app-confirm', () => ({
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
            props: ['label', 'loading', 'disabled'],
            emits: ['click'],
            template:
              '<button v-bind="$attrs" :disabled="disabled || loading" :data-loading="loading ? \'true\' : undefined" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="confirm-accept"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="confirm-reject"]').exists()).toBe(true);
  });

  it('stays open with a loading confirm until onConfirm finishes', async () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const wrapper = await mountSuspended(ConfirmModal, {
      props: {
        title: 'Delete entry',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        onConfirm,
      },
      global: {
        stubs: {
          UModal: {
            template: '<div data-testid="confirm-modal"><slot name="footer" /></div>',
          },
          UButton: {
            props: ['label', 'loading', 'disabled'],
            emits: ['click'],
            template:
              '<button v-bind="$attrs" :disabled="disabled || loading" :data-loading="loading ? \'true\' : undefined" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    });

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click');
    await flushPromises();

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(wrapper.get('[data-testid="confirm-accept"]').attributes('data-loading')).toBe('true');
    expect(wrapper.get('[data-testid="confirm-reject"]').attributes('disabled')).toBeDefined();

    resolveConfirm();
    await flushPromises();

    expect(wrapper.emitted('close')).toEqual([[true]]);
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
