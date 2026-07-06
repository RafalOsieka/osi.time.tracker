import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { Form } from '@primevue/forms';
import TableHeader from '../../app/components/TableHeader.vue';
import EmptyState from '../../app/components/EmptyState.vue';
import RowActions from '../../app/components/RowActions.vue';
import FormFieldWrap from '../../app/components/FormFieldWrap.vue';

const ButtonStub = {
  props: ['label', 'icon', 'ariaLabel'],
  emits: ['click'],
  template:
    '<button v-bind="$attrs" :aria-label="ariaLabel" @click="$emit(\'click\')">{{ label }}</button>',
};

describe('TableHeader', () => {
  it('renders the title and New button, and emits create on click', async () => {
    const wrapper = await mountSuspended(TableHeader, {
      props: { title: 'Clients', newLabel: 'New client', newTestid: 'new-client-button' },
      global: { stubs: { Button: ButtonStub } },
    });

    expect(wrapper.text()).toContain('Clients');
    const button = wrapper.find('[data-testid="new-client-button"]');
    expect(button.exists()).toBe(true);

    await button.trigger('click');
    expect(wrapper.emitted('create')).toHaveLength(1);
  });
});

describe('EmptyState', () => {
  it('renders the message and CTA, and emits create on click', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: { message: 'No clients yet', ctaLabel: 'Add one', testid: 'clients-empty-state' },
      global: { stubs: { Button: ButtonStub } },
    });

    expect(wrapper.find('[data-testid="clients-empty-state"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No clients yet');

    const cta = wrapper.find('[data-testid="empty-state-cta"]');
    expect(cta.exists()).toBe(true);
    await cta.trigger('click');
    expect(wrapper.emitted('create')).toHaveLength(1);
  });
});

describe('RowActions', () => {
  it('exposes accessible names and testids, and emits edit/delete', async () => {
    const wrapper = await mountSuspended(RowActions, {
      props: {
        editLabel: 'Edit',
        deleteLabel: 'Delete',
        editTestid: 'edit-client-1',
        deleteTestid: 'delete-client-1',
      },
      global: { stubs: { Button: ButtonStub } },
    });

    const editButton = wrapper.find('[data-testid="edit-client-1"]');
    const deleteButton = wrapper.find('[data-testid="delete-client-1"]');
    expect(editButton.attributes('aria-label')).toBe('Edit');
    expect(deleteButton.attributes('aria-label')).toBe('Delete');

    await editButton.trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);

    await deleteButton.trigger('click');
    expect(wrapper.emitted('delete')).toHaveLength(1);
  });
});

describe('FormFieldWrap', () => {
  it('shows no error for a valid field', async () => {
    const wrapper = await mountSuspended(
      {
        components: { Form, FormFieldWrap },
        template: `
          <Form :initial-values="{ name: 'Acme' }">
            <FormFieldWrap label="Name" name="name" error-testid="name-error">
              <input data-testid="name-input" />
            </FormFieldWrap>
          </Form>
        `,
      },
      {},
    );

    expect(wrapper.find('[data-testid="name-error"]').exists()).toBe(false);
  });

  it('associates and announces the error when a serverError is supplied', async () => {
    const wrapper = await mountSuspended(
      {
        components: { Form, FormFieldWrap },
        template: `
          <Form :initial-values="{ name: '' }">
            <FormFieldWrap label="Name" name="name" error-testid="name-error" server-error="Name is required">
              <input data-testid="name-input" />
            </FormFieldWrap>
          </Form>
        `,
      },
      {},
    );

    const error = wrapper.find('[data-testid="name-error"]');
    expect(error.exists()).toBe(true);
    expect(error.attributes('role')).toBe('alert');
    expect(error.text()).toContain('Name is required');
  });
});
