import { defineComponent, h } from 'vue';
import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import LoginPage from '../../app/pages/login.vue';
import IndexPage from '../../app/pages/index.vue';
import DefaultLayout from '../../app/layouts/default.vue';
import AuthLayout from '../../app/layouts/auth.vue';

async function routeMeta() {
  let routes: { path: string; meta: Record<string, unknown> }[] = [];
  const Probe = defineComponent({
    setup() {
      const router = useRouter();
      routes = router
        .getRoutes()
        .map((r) => ({ path: r.path, meta: r.meta as Record<string, unknown> }));
      return () => h('div');
    },
  });
  await mountSuspended(Probe);
  return routes;
}

describe('layout selection per page', () => {
  it('maps /login to the auth layout and marks it public', async () => {
    const routes = await routeMeta();
    const login = routes.find((r) => r.path === '/login');
    expect(login).toBeTruthy();
    expect(login?.meta.layout).toBe('auth');
    expect(login?.meta.public).toBe(true);
  });

  it('leaves / on the default layout (no explicit layout meta, not public)', async () => {
    const routes = await routeMeta();
    const index = routes.find((r) => r.path === '/');
    expect(index).toBeTruthy();
    expect(index?.meta.layout).toBeUndefined();
    expect(index?.meta.public).toBeUndefined();
  });
});

describe('preserved test hooks', () => {
  it('login page keeps its form testids', async () => {
    // Stub the PrimeVue inputs: this isolated mount has no `$primevue` config,
    // and we only assert that the test hooks (data-testid) survive the move.
    const inputStub = { template: '<input />' };
    const wrapper = await mountSuspended(LoginPage, {
      global: {
        stubs: {
          InputText: inputStub,
          Password: inputStub,
          Button: { template: '<button><slot />{{ label }}</button>', props: ['label'] },
        },
      },
    });
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="username"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-button"]').exists()).toBe(true);
  });

  it('home page keeps the auth-status hook', async () => {
    const wrapper = await mountSuspended(IndexPage);
    expect(wrapper.find('[data-testid="auth-status"]').exists()).toBe(true);
  });

  it('default layout exposes the logout-button in its header', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => h('p', { 'data-testid': 'slotted' }, 'content') },
    });
    expect(wrapper.find('[data-testid="logout-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true);
  });

  it('auth layout has no logout control', async () => {
    const wrapper = await mountSuspended(AuthLayout, {
      slots: { default: () => h('p', { 'data-testid': 'slotted' }, 'content') },
    });
    expect(wrapper.find('[data-testid="logout-button"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true);
  });
});
