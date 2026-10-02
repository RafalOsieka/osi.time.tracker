<script setup lang="ts">
import type { AvatarProps, DropdownMenuItem } from '@nuxt/ui';

const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

type ColorModePreference = 'light' | 'dark' | 'system';

const { t } = useI18n();
const { logout, user } = useAuth();
const colorMode = useColorMode();

/** Primary identity line: the required display name (REQ-405). */
const primaryLabel = computed(() => user.value?.displayName ?? '');
const secondaryEmail = computed(() => user.value?.email ?? '');

/** Single initial of the display name for the avatar. */
const avatarInitial = computed(() => {
  const ch = primaryLabel.value.charAt(0);
  return ch ? ch.toUpperCase() : '?';
});

const avatar = computed<AvatarProps>(() => ({
  alt: primaryLabel.value || undefined,
  text: avatarInitial.value,
  color: 'primary',
}));

const pending = ref(false);

async function onLogout() {
  pending.value = true;
  try {
    await logout();
    await navigateTo('/login');
  } finally {
    pending.value = false;
  }
}

const themeOptions = [
  { value: 'light', icon: 'i-lucide-sun' },
  { value: 'dark', icon: 'i-lucide-moon' },
  { value: 'system', icon: 'i-lucide-monitor' },
] satisfies Array<{ value: ColorModePreference; icon: string }>;

/**
 * Account menu opened from UUser (expanded) or avatar (collapsed): Profile and the
 * Theme submenu (ui-theming REQ-402), then Log out in its own group (REQ-405).
 * Theme items are checkboxes so the active preference is exposed as checked.
 */
const menuItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('layout.profile'),
      icon: 'i-lucide-user',
      to: '/profile',
    },
    {
      label: t('theme.toggleLabel'),
      icon: 'i-lucide-sun-moon',
      children: themeOptions.map(({ value, icon }) => ({
        label: t(`theme.${value}`),
        icon,
        type: 'checkbox' as const,
        checked: colorMode.preference === value,
        onSelect(event: Event) {
          // Keep the menu open on a radio-like pick instead of toggling the checkbox.
          event.preventDefault();
          colorMode.preference = value;
        },
      })),
    },
  ],
  [
    {
      label: t('layout.logoutButton'),
      icon: 'i-lucide-log-out',
      color: 'error' as const,
      disabled: pending.value,
      onSelect: () => {
        void onLogout();
      },
    },
  ],
]);
</script>

<template>
  <div
    class="flex w-full min-w-0"
    :class="collapsed ? 'justify-center' : undefined"
    data-testid="app-user-footer"
  >
    <!--
      UUser works as the dropdown trigger: UDropdownMenu uses as-child, and
      UUser is a Primitive that can render as a button. Open upward from the footer.
    -->
    <UDropdownMenu
      :items="menuItems"
      :content="{ side: 'top', align: 'start', sideOffset: 8 }"
      :ui="{ content: 'min-w-48' }"
      data-testid="app-user-footer-menu"
    >
      <!-- Expanded: full UUser row is the clickable account control -->
      <UUser
        v-if="!collapsed && primaryLabel"
        as="button"
        type="button"
        :name="primaryLabel"
        :description="secondaryEmail || undefined"
        :avatar="avatar"
        size="md"
        class="w-full min-w-0 cursor-pointer rounded-md px-1 py-1 text-start hover:bg-elevated"
        data-testid="app-user-footer-trigger"
        :ui="{
          root: 'w-full min-w-0',
          wrapper: 'min-w-0',
          name: 'truncate text-default',
          description: 'truncate',
        }"
      >
        <template #name>
          <span data-testid="app-user-footer-primary">{{ primaryLabel }}</span>
        </template>
        <template v-if="secondaryEmail" #description>
          <span data-testid="app-user-footer-email">{{ secondaryEmail }}</span>
        </template>
      </UUser>

      <!-- Collapsed: avatar-only trigger (same menu, same logout item) -->
      <UButton
        v-else
        color="neutral"
        variant="ghost"
        square
        :avatar="avatar"
        :aria-label="primaryLabel || t('layout.logoutButton')"
        data-testid="app-user-footer-trigger"
      />
    </UDropdownMenu>
  </div>
</template>
