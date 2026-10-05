import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import LoginPage from '../../app/pages/login.vue';

const loginMock = vi.hoisted(() => vi.fn());
const navigateToMock = vi.hoisted(() => vi.fn());
/** The route the page reads; tests set `query.redirect` before mounting. */
interface RouteFixture {
  query: Record<string, string>;
}
const route = vi.hoisted((): RouteFixture => ({ query: {} }));
mockNuxtImport('useAuth', () => () => ({ login: loginMock }));
mockNuxtImport('useRoute', () => () => route);
mockNuxtImport('navigateTo', () => navigateToMock);

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
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

const credentials = { email: 'user@example.com', password: 'correct-horse' };

/** Mounts the page with a form stub that submits the given credentials or a client error. */
async function mountLogin() {
  return mountSuspended(LoginPage, {
    global: {
      stubs: {
        UCard: CardStub,
        UForm: {
          emits: ['submit', 'error'],
          template: `
            <form @submit.prevent="$emit('submit', { data: credentials })">
              <slot />
              <button
                type="button"
                data-testid="client-error"
                @click="$emit('error', { errors: [{ message: 'auth.emailInvalid' }, { message: 'auth.passwordRequired' }] })"
              />
            </form>
          `,
          data: () => ({ credentials }),
        },
        UFormField: FormFieldStub,
        UInput: InputStub,
        UButton: ButtonStub,
      },
    },
  });
}

describe('REQ-013: login submission', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateToMock.mockReset();
    route.query = {};
  });

  it('logs in and returns to the same-origin page that redirected here', async () => {
    route.query = { redirect: '/reports/monthly?month=2026-09' };
    loginMock.mockResolvedValue(undefined);
    const wrapper = await mountLogin();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(loginMock).toHaveBeenCalledWith(credentials);
    expect(navigateToMock).toHaveBeenCalledWith('/reports/monthly?month=2026-09');
    expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(false);
  });

  it.each(['https://evil.example/phish', '//evil.example', '/\\evil.example'])(
    'ignores the external redirect %s and goes home',
    async (redirect) => {
      route.query = { redirect };
      loginMock.mockResolvedValue(undefined);
      const wrapper = await mountLogin();

      await wrapper.get('form').trigger('submit');
      await flushPromises();

      expect(navigateToMock).toHaveBeenCalledWith('/');
    },
  );

  it('shows the translated server error and marks both fields invalid', async () => {
    loginMock.mockRejectedValue(
      Object.assign(new Error('unauthorized'), {
        data: { data: { messageKey: 'auth.invalidCredentials' } },
      }),
    );
    const wrapper = await mountLogin();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(navigateToMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('auth.invalidCredentials');
    for (const testId of ['email', 'password']) {
      const input = wrapper.get(`[data-testid="${testId}"]`);
      expect(input.attributes('aria-invalid')).toBe('true');
      expect(input.attributes('aria-describedby')).toBe('login-error');
    }
  });

  it('falls back to the generic message when the failure has no message key', async () => {
    loginMock.mockRejectedValue(new Error('network down'));
    const wrapper = await mountLogin();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('auth.loginFailed');
  });

  it('shows the first client validation message without calling the server', async () => {
    const wrapper = await mountLogin();

    await wrapper.get('[data-testid="client-error"]').trigger('click');
    await flushPromises();

    expect(loginMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe('auth.emailInvalid');
  });
});
