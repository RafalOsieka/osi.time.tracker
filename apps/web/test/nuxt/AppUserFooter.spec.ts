import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import AppUserFooter from '../../app/components/AppUserFooter.vue';
import type { DropdownMenuItem } from '@nuxt/ui';

const logoutMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const navigateToMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
type SessionUser = { email: string; displayName: string };
const userState = vi.hoisted(() => {
  const value: SessionUser = {
    email: 'alice@example.com',
    displayName: 'Alice Liddell',
  };
  return { value };
});

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

mockNuxtImport('useAuth', () => () => ({
  user: userState,
  logout: logoutMock,
  loggedIn: { value: true },
  login: vi.fn(),
  refresh: vi.fn(),
}));

mockNuxtImport('navigateTo', () => navigateToMock);

const colorMode = vi.hoisted(() => ({ preference: 'dark' }));
mockNuxtImport('useColorMode', () => () => colorMode);

const DropdownMenuStub = {
  props: {
    items: { type: Array, default: () => [] },
    content: { type: Object, default: undefined },
  },
  template: `
    <div data-testid="app-user-footer-menu">
      <slot />
      <button
        v-for="(item, index) in flatItems"
        :key="index"
        type="button"
        data-testid="logout-button"
        :disabled="item.disabled"
        @click="item.onSelect?.()"
      >
        {{ item.label }}
      </button>
    </div>
  `,
  computed: {
    flatItems(this: { items?: DropdownMenuItem[][] | DropdownMenuItem[] }): DropdownMenuItem[] {
      const out: DropdownMenuItem[] = [];
      for (const item of this.items ?? []) {
        if (Array.isArray(item)) out.push(...item);
        else out.push(item);
      }
      return out;
    },
  },
};

const UserStub = {
  props: {
    name: { type: String, default: '' },
    description: { type: String, default: undefined },
    avatar: { type: Object, default: undefined },
    size: { type: String, default: 'md' },
    as: { type: String, default: 'div' },
  },
  template: `
    <component
      :is="as === 'button' ? 'button' : 'div'"
      data-testid="app-user-footer-trigger"
      :data-avatar-text="avatar?.text"
      type="button"
    >
      <slot name="name">{{ name }}</slot>
      <slot v-if="description" name="description">{{ description }}</slot>
    </component>
  `,
};

const ButtonStub = {
  inheritAttrs: false,
  props: {
    avatar: { type: Object, default: undefined },
    square: { type: Boolean, default: false },
  },
  template: `
    <button
      type="button"
      data-testid="app-user-footer-trigger"
      :data-avatar-text="avatar?.text"
      v-bind="$attrs"
    >
      <slot />
    </button>
  `,
};

const baseStubs = {
  UDropdownMenu: DropdownMenuStub,
  UUser: UserStub,
  UButton: ButtonStub,
};

describe('AppUserFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    colorMode.preference = 'dark';
    userState.value = {
      email: 'alice@example.com',
      displayName: 'Alice Liddell',
    };
  });

  it('shows UUser trigger with name, email, and avatar initial when expanded', async () => {
    const wrapper = await mountSuspended(AppUserFooter, {
      props: { collapsed: false },
      global: { stubs: baseStubs },
    });

    expect(wrapper.find('[data-testid="app-user-footer-primary"]').text()).toBe('Alice Liddell');
    expect(wrapper.find('[data-testid="app-user-footer-email"]').text()).toBe('alice@example.com');
    expect(
      wrapper.find('[data-testid="app-user-footer-trigger"]').attributes('data-avatar-text'),
    ).toBe('A');
    expect(wrapper.findAll('[data-testid="logout-button"]').map((b) => b.text())).toContain(
      'layout.logoutButton',
    );
  });

  it('uses avatar button trigger when collapsed', async () => {
    const wrapper = await mountSuspended(AppUserFooter, {
      props: { collapsed: true },
      global: { stubs: baseStubs },
    });

    expect(wrapper.find('[data-testid="app-user-footer-primary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="app-user-footer-trigger"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="app-user-footer-trigger"]').attributes('data-avatar-text'),
    ).toBe('A');
  });

  it('logs out and navigates to login via menu item', async () => {
    const wrapper = await mountSuspended(AppUserFooter, {
      props: { collapsed: false },
      global: { stubs: baseStubs },
    });

    const logout = wrapper
      .findAll('[data-testid="logout-button"]')
      .find((button) => button.text() === 'layout.logoutButton');
    await logout!.trigger('click');
    await vi.waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
    });
    expect(navigateToMock).toHaveBeenCalledWith('/login');
  });

  it('lists Profile and the Theme submenu, then Log out in its own group', async () => {
    let items: DropdownMenuItem[][] = [];
    await mountSuspended(AppUserFooter, {
      props: { collapsed: false },
      global: {
        stubs: {
          UUser: UserStub,
          UButton: ButtonStub,
          UDropdownMenu: {
            props: {
              items: { type: Array, default: () => [] },
            },
            template: '<div><slot /></div>',
            watch: {
              items: {
                immediate: true,
                deep: true,
                handler(value: DropdownMenuItem[][]) {
                  items = value;
                },
              },
            },
          },
        },
      },
    });

    expect(items.map((group) => group.map((item) => item.label))).toEqual([
      ['layout.profile', 'theme.toggleLabel'],
      ['layout.logoutButton'],
    ]);
    const [profile, theme] = items[0]!;
    expect(profile?.to).toBe('/profile');
    expect(items[1]![0]?.icon).toBe('i-lucide-log-out');

    // The active preference (dark) is the only checked theme item.
    const themeItems = (theme?.children ?? []).flat();
    expect(themeItems.map((item) => [item.label, item.type, item.checked])).toEqual([
      ['theme.light', 'checkbox', false],
      ['theme.dark', 'checkbox', true],
      ['theme.system', 'checkbox', false],
    ]);

    const event = new Event('select', { cancelable: true });
    themeItems[0]?.onSelect?.(event);
    expect(colorMode.preference).toBe('light');
    expect(event.defaultPrevented).toBe(true);
  });
});
