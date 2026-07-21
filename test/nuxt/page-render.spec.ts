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
    const inputStub = {
      props: ['modelValue'],
      template: '<input v-bind="$attrs" />',
    };
    const wrapper = await mountSuspended(LoginPage, {
      global: {
        stubs: {
          UCard: { template: '<div data-testid="login-card"><slot /></div>' },
          UForm: {
            template: '<form data-testid="login-form" v-bind="$attrs"><slot /></form>',
          },
          UFormField: { template: '<div><slot /></div>' },
          UInput: inputStub,
          UButton: {
            template: '<button v-bind="$attrs"><slot />{{ label }}</button>',
            props: ['label'],
          },
        },
      },
    });
    expect(wrapper.find('[data-testid="login-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-form"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="email"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="password"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="login-button"]').exists()).toBe(true);
  });

  it('home page renders the timer view', async () => {
    const wrapper = await mountSuspended(IndexPage, {
      global: {
        stubs: {
          EmptyState: { template: '<div data-testid="timer-view-empty-state" />' },
          TimerBulkAssignDialog: { template: '<div />' },
          TimerAddEntryDialog: { template: '<div />' },
        },
      },
    });
    expect(wrapper.find('[data-testid="timer-view-page"]').exists()).toBe(true);
  });

  it('default layout renders the shell top bar and page content', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      global: {
        stubs: {
          UDashboardGroup: { template: '<div><slot /></div>' },
          UDashboardSidebar: {
            template: '<aside data-testid="app-rail"><slot /><slot name="header" /></aside>',
          },
          UDashboardPanel: {
            template:
              '<div data-testid="app-content"><slot name="header" /><slot name="body" /></div>',
          },
          UDashboardNavbar: {
            template:
              '<header data-testid="app-topbar"><slot name="right" /><slot name="center" /></header>',
          },
          UDashboardSidebarToggle: { template: '<button data-testid="sidebar-toggle" />' },
          AppSidebar: { template: '<nav data-testid="app-sidebar" />' },
          AppTimer: { template: '<div data-testid="app-timer" />' },
          AppUtilityMenu: {
            template:
              '<div data-testid="utility-menu-button"><a data-testid="logout-button">Log out</a></div>',
          },
          NuxtPage: { template: '<div data-testid="slotted">content</div>' },
        },
      },
    });
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="logout-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true);
  });

  it('auth layout has no logout control and no theme toggle', async () => {
    const wrapper = await mountSuspended(AuthLayout, {
      slots: { default: () => h('p', { 'data-testid': 'slotted' }, 'content') },
    });
    expect(wrapper.find('[data-testid="logout-button"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="theme-toggle-group"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true);
  });
});
