import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import InlineEditText from '../../app/components/InlineEditText.vue';

const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" @keydown.enter="$emit(\'keydown\', $event)" @keydown.esc="$emit(\'keydown\', $event)" />',
  props: ['modelValue'],
  emits: ['update:modelValue', 'blur', 'keydown'],
};
const TooltipStub = {
  props: ['text', 'content', 'disabled'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};

const stubs = { UInput: InputStub, UTooltip: TooltipStub };

describe('InlineEditText', () => {
  it('renders a readonly display field until edit is requested', async () => {
    const wrapper = await mountSuspended(InlineEditText, {
      props: {
        modelValue: 'API review',
        editing: false,
        fieldLabel: 'Title',
        displayTestid: 'title',
        inputTestid: 'title-input',
      },
      global: { stubs },
    });

    const display = wrapper.find('[data-testid="title"]');
    expect(display.exists()).toBe(true);
    expect(display.attributes('readonly')).toBeDefined();
    expect(wrapper.find('[data-testid="title-input"]').exists()).toBe(false);

    await display.trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);
  });

  it('commits on enter and blur while editing', async () => {
    const wrapper = await mountSuspended(InlineEditText, {
      props: {
        modelValue: 'API review',
        editing: true,
        fieldLabel: 'Title',
        displayTestid: 'title',
        inputTestid: 'title-input',
      },
      global: { stubs },
    });

    const input = wrapper.find('[data-testid="title-input"]');
    expect(input.exists()).toBe(true);
    expect(wrapper.find('[data-testid="title"]').exists()).toBe(false);

    await input.setValue('New title');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['New title']);

    await input.trigger('keydown.enter');
    expect(wrapper.emitted('commit')).toHaveLength(1);

    await input.trigger('blur');
    expect(wrapper.emitted('commit')).toHaveLength(2);
  });

  it('cancels on escape', async () => {
    const wrapper = await mountSuspended(InlineEditText, {
      props: {
        modelValue: 'API review',
        editing: true,
        fieldLabel: 'Title',
        displayTestid: 'title',
        inputTestid: 'title-input',
      },
      global: { stubs },
    });

    await wrapper.find('[data-testid="title-input"]').trigger('keydown.esc');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('commit')).toBeUndefined();
  });

  it('does not start editing when disabled', async () => {
    const wrapper = await mountSuspended(InlineEditText, {
      props: {
        modelValue: 'API review',
        editing: false,
        disabled: true,
        fieldLabel: 'Title',
        displayTestid: 'title',
        inputTestid: 'title-input',
      },
      global: { stubs },
    });

    await wrapper.find('[data-testid="title"]').trigger('click');
    expect(wrapper.emitted('edit')).toBeUndefined();
  });

  it('wraps the display value in the overflow tooltip host', async () => {
    const wrapper = await mountSuspended(InlineEditText, {
      props: {
        modelValue: 'A very long task title that should truncate',
        editing: false,
        fieldLabel: 'Title',
        displayTestid: 'title',
        inputTestid: 'title-input',
      },
      global: { stubs },
    });

    expect(wrapper.find('[data-overflow-tooltip]').exists()).toBe(true);
  });
});
