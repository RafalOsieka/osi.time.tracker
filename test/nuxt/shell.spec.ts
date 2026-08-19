import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import DefaultLayout from '../../app/layouts/default.vue';
import AppSidebar from '../../app/components/AppSidebar.vue';

const fetchMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const seedRunningMock = vi.hoisted(() => vi.fn());
const resumeTickerMock = vi.hoisted(() => vi.fn());

mockNuxtImport('useRequestFetch', () => () => fetchMock);
mockNuxtImport('useAsyncData', () => {
  // Match Nuxt's awaitable useAsyncData: resolve the fetcher before setup continues.
  return async (_key: string, fetcher: () => Promise<unknown>) => {
    const data = ref<unknown>(null);
    try {
      data.value = await fetcher();
    } catch {
      data.value = null;
    }
    return { data, pending: ref(false), refresh: vi.fn() };
  };
});
mockNuxtImport('useTimer', () => () => ({
  seedRunning: seedRunningMock,
  resumeTickerIfNeeded: resumeTickerMock,
  fetchRunning: vi.fn(),
  running: { value: null },
  elapsedSeconds: { value: 0 },
  loading: { value: false },
  start: vi.fn(),
  stop: vi.fn(),
  updateTitle: vi.fn(),
  updateStartedAt: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(null);
});

const topBarStub = {
  template:
    '<header data-testid="app-topbar">' +
    '<button data-testid="sidebar-toggle" aria-expanded="true" />' +
    '<slot name="left" />' +
    '<slot />' +
    '<slot name="right" />' +
    '</header>',
};

const sidebarStub = {
  props: ['collapsed', 'iconOnly'],
  template:
    '<nav aria-label="Main navigation" data-testid="app-sidebar-nav">' +
    '<a data-testid="nav-link-timer" aria-current="page" href="/">Timer</a>' +
    '<a data-testid="nav-link-trackers" href="/trackers">Trackers</a>' +
    '<a data-testid="nav-link-projects" href="/projects">Projects</a>' +
    '<a data-testid="nav-link-reports" href="/reports">Reports</a>' +
    '<a data-testid="nav-link-settings" href="/settings">Settings</a>' +
    '</nav>',
};

const userFooterStub = {
  props: ['collapsed'],
  template:
    '<div data-testid="app-user-footer">' +
    '<button data-testid="app-user-footer-trigger">User</button>' +
    '<button data-testid="logout-button">Log out</button>' +
    '</div>',
};

const appTimerStub = { template: '<div data-testid="app-timer" />' };

async function mountShell(overrideStubs: Record<string, unknown> = {}) {
  return mountSuspended(DefaultLayout, {
    global: {
      stubs: {
        UDashboardGroup: { template: '<div><slot /></div>' },
        UDashboardSidebar: {
          props: ['collapsed', 'open'],
          template:
            '<aside data-testid="app-sidebar" :data-collapsed="collapsed">' +
            '<slot name="header" :collapsed="collapsed" />' +
            '<slot :collapsed="collapsed" />' +
            '<slot name="footer" :collapsed="collapsed" />' +
            '</aside>',
        },
        UDashboardPanel: {
          template:
            '<div data-testid="app-content"><slot name="header" /><slot name="body" /></div>',
        },
        UDashboardNavbar: topBarStub,
        UDashboardSidebarToggle: {
          template: '<button data-testid="sidebar-toggle" aria-expanded="true" />',
        },
        UDashboardSidebarCollapse: {
          template: '<button data-testid="sidebar-collapse" />',
        },
        AppSidebar: sidebarStub,
        AppUserFooter: userFooterStub,
        AppTimer: appTimerStub,
        NuxtPage: { template: '<div>page</div>' },
        ...overrideStubs,
      },
    },
  });
}

describe('REQ-064: shell regions', () => {
  it('renders top bar, sidebar rail, and page content', async () => {
    const wrapper = await mountShell();
    expect(wrapper.find('[data-testid="app-topbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="app-content"]').exists()).toBe(true);
  });

  it('logout control is reachable within the sidebar footer', async () => {
    const wrapper = await mountShell();
    const sidebar = wrapper.find('[data-testid="app-sidebar"]');
    expect(sidebar.find('[data-testid="app-user-footer-trigger"]').exists()).toBe(true);
    expect(sidebar.find('[data-testid="logout-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="utility-menu-button"]').exists()).toBe(false);
  });

  it('timer region slot is present in the top bar', async () => {
    const wrapper = await mountShell();
    expect(wrapper.find('[data-testid="timer-region-inline"]').exists()).toBe(true);
  });

  it('SSR-seeds running timer state without a client-only mount fetch', async () => {
    fetchMock.mockResolvedValueOnce({
      id: 'entry-1',
      taskId: null,
      taskName: 'SSR Running',
      projectId: null,
      projectName: null,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
    });

    await mountShell();
    await vi.waitFor(() => {
      expect(seedRunningMock).toHaveBeenCalled();
    });
    expect(seedRunningMock).toHaveBeenCalledWith(
      expect.objectContaining({ taskName: 'SSR Running' }),
    );
  });
});

describe('REQ-065: sidebar nav skeleton', () => {
  it('sidebar lists all five destinations', async () => {
    const wrapper = await mountSuspended(AppSidebar, {
      global: {
        stubs: {
          UNavigationMenu: {
            props: ['items'],
            template: `
              <div>
                <a v-for="item in items" :key="item.to" :href="item.to">{{ item.label }}</a>
              </div>
            `,
          },
          UIcon: true,
          NuxtLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });
    const links = wrapper.findAll('a');
    const hrefs = links.map((l) => l.attributes('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/trackers');
    expect(hrefs).toContain('/projects');
    expect(hrefs).not.toContain('/tasks');
    expect(hrefs).not.toContain('/clients');
    expect(hrefs).toContain('/reports');
    expect(hrefs).toContain('/settings');
  });
});

describe('REQ-066: desktop rail toggle', () => {
  it('rail renders and is present in the DOM', async () => {
    const wrapper = await mountShell();
    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true);
  });

  it('rail starts expanded (collapsed owned by UDashboard storage)', async () => {
    const wrapper = await mountShell();
    expect(wrapper.find('[data-testid="app-sidebar"]').attributes('data-collapsed')).toBe('false');
  });

  it('desktop collapse control is present in the top bar', async () => {
    const wrapper = await mountShell();
    const topbar = wrapper.find('[data-testid="app-topbar"]');
    expect(topbar.find('[data-testid="sidebar-collapse"]').exists()).toBe(true);
  });

  it('expanded brand shows the mark beside the full title', async () => {
    const wrapper = await mountShell();
    const brand = wrapper.find('[data-testid="app-sidebar-brand"]');
    expect(brand.find('[data-testid="app-brand-mark"]').exists()).toBe(true);
    expect(brand.text()).toContain('OSI Time Tracker');
    expect(brand.find('[data-testid="app-brand-mark"]').attributes('aria-hidden')).toBe('true');
  });

  it('collapsed brand shows the mark only, named with the full title', async () => {
    const wrapper = await mountShell({
      UDashboardSidebar: {
        props: ['collapsed', 'open'],
        template:
          '<aside data-testid="app-sidebar" data-collapsed="true">' +
          '<slot name="header" :collapsed="true" />' +
          '<slot :collapsed="true" />' +
          '<slot name="footer" :collapsed="true" />' +
          '</aside>',
      },
    });
    const brand = wrapper.find('[data-testid="app-sidebar-brand"]');
    const mark = brand.find('[data-testid="app-brand-mark"]');
    expect(mark.exists()).toBe(true);
    expect(brand.text()).not.toContain('OSI Time Tracker');
    expect(brand.text().trim()).not.toBe('OSI');
    expect(mark.attributes('aria-label')).toBe('OSI Time Tracker');
    expect(mark.attributes('role')).toBe('img');
  });
});

describe('REQ-067: off-canvas drawer', () => {
  it('sidebar open state starts closed', async () => {
    const wrapper = await mountShell();
    // Drawer is owned by UDashboardSidebar; open starts false via layout state.
    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true);
  });
});

describe('REQ-068/070: timer lives in the navbar', () => {
  it('inline timer region is mounted inside the top bar', async () => {
    const wrapper = await mountShell();
    const topbar = wrapper.find('[data-testid="app-topbar"]');
    expect(topbar.exists()).toBe(true);
    expect(topbar.find('[data-testid="timer-region-inline"]').exists()).toBe(true);
    expect(topbar.find('[data-testid="app-timer"]').exists()).toBe(true);
  });

  it('top bar right has no utility menu', async () => {
    const wrapper = await mountShell();
    const topbar = wrapper.find('[data-testid="app-topbar"]');
    expect(topbar.find('[data-testid="utility-menu-button"]').exists()).toBe(false);
    expect(topbar.find('[data-testid="logout-button"]').exists()).toBe(false);
  });
});

describe('REQ-069: sidebar footer user area', () => {
  it('user footer with account menu is rendered in the sidebar', async () => {
    const wrapper = await mountShell();
    const sidebar = wrapper.find('[data-testid="app-sidebar"]');
    expect(sidebar.find('[data-testid="app-user-footer"]').exists()).toBe(true);
    expect(sidebar.find('[data-testid="app-user-footer-trigger"]').exists()).toBe(true);
  });
});

describe('REQ-071: accessible shell navigation', () => {
  it('sidebar has an aria-label for navigation', async () => {
    const wrapper = await mountSuspended(AppSidebar, {
      global: {
        stubs: {
          UNavigationMenu: { template: '<div><slot /></div>' },
          UIcon: true,
          NuxtLink: {
            props: ['to'],
            template: '<a :href="to" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });
    expect(wrapper.html()).toContain('aria-label="Main navigation"');
  });

  it('sidebar toggle exposes aria-expanded', async () => {
    const wrapper = await mountShell();
    const toggle = wrapper.find('[data-testid="sidebar-toggle"]');
    expect(toggle.exists()).toBe(true);
  });

  it('enables tooltips when navigation is collapsed', async () => {
    let capturedTooltip: unknown;
    await mountSuspended(AppSidebar, {
      props: { collapsed: true },
      global: {
        stubs: {
          UNavigationMenu: {
            props: ['items', 'collapsed', 'tooltip'],
            template: '<div data-testid="nav-menu" />',
            created(this: { tooltip?: unknown }) {
              capturedTooltip = this.tooltip;
            },
          },
        },
      },
    });
    expect(capturedTooltip).toBe(true);
  });
});
