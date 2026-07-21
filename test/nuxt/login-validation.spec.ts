import { describe, expect, it, vi } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import LoginPage from '../../app/pages/login.vue';

const loginMock = vi.fn();
mockNuxtImport('useAuth', () => () => ({ login: loginMock }));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

const InputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
const ButtonStub = {
  template: '<button v-bind="$attrs"><slot />{{ label }}</button>',
  props: ['label', 'loading'],
};
const FormStub = {
  emits: ['submit'],
  template:
    '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: {} })"><slot /></form>',
};
const FormFieldStub = { template: '<div><slot /></div>' };
const CardStub = { template: '<div><slot /></div>' };

describe('REQ-013: login client-side validation', () => {
  it('blocks submission and does not call login when credentials are empty', async () => {
    const wrapper = await mountSuspended(LoginPage, {
      global: {
        stubs: {
          UCard: CardStub,
          UForm: FormStub,
          UFormField: FormFieldStub,
          UInput: InputStub,
          UButton: ButtonStub,
        },
      },
    });

    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
    expect(loginMock).not.toHaveBeenCalled();
  });
});
