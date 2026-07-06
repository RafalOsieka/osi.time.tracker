import { describe, expect, it, vi } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import DefaultLayout from '../../app/layouts/default.vue';

const ConfirmDialogStub = { template: '<div data-testid="confirm-dialog" />' };

const confirmRequireMock = vi.fn();
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequireMock }),
}));

// A minimal page that triggers a confirmation exactly like clients/projects/tasks do,
// reaching the layout-level dialog via the shared useConfirm() composable.
const DeletePageStub = {
  setup() {
    function onDelete() {
      confirmRequireMock({ header: 'Delete client', message: 'Are you sure?', accept: () => {} });
    }
    return { onDelete };
  },
  template: '<button data-testid="delete-button" @click="onDelete">Delete</button>',
};

describe('REQ-NFR-032: single app-level confirm dialog', () => {
  it('mounts exactly one ConfirmDialog in the default layout', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      global: {
        stubs: {
          ConfirmDialog: ConfirmDialogStub,
          NuxtPage: { template: '<div data-testid="app-content" />' },
        },
      },
    });

    expect(wrapper.findAllComponents(ConfirmDialogStub)).toHaveLength(1);
  });

  it('a page delete action requests confirmation through the shared confirm service', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      global: {
        stubs: {
          ConfirmDialog: ConfirmDialogStub,
          NuxtPage: DeletePageStub,
        },
      },
    });

    // Exactly one dialog instance exists in the whole layout+page tree.
    expect(wrapper.findAllComponents(ConfirmDialogStub)).toHaveLength(1);

    await wrapper.find('[data-testid="delete-button"]').trigger('click');
    expect(confirmRequireMock).toHaveBeenCalledWith(
      expect.objectContaining({ header: 'Delete client' }),
    );
  });
});
