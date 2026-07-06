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

const InputTextStub = { template: '<input v-bind="$attrs" />' };
const PasswordStub = { template: '<input v-bind="$attrs" />' };
const ButtonStub = {
  template: '<button v-bind="$attrs"><slot />{{ label }}</button>',
  props: ['label', 'loading'],
};

describe('REQ-AUTH-007: login client-side validation', () => {
  it('blocks submission and does not call login when credentials are empty', async () => {
    const wrapper = await mountSuspended(LoginPage, {
      global: {
        stubs: {
          Card: { template: '<div><slot name="content" /></div>' },
          InputText: InputTextStub,
          Password: PasswordStub,
          Button: ButtonStub,
        },
      },
    });

    await wrapper.find('[data-testid="login-form"]').trigger('submit');
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(loginMock).not.toHaveBeenCalled();
  });
});
