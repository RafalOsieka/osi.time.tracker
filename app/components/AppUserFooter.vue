<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AvatarProps, DropdownMenuItem } from '@nuxt/ui';

const props = withDefaults(defineProps<{ collapsed?: boolean }>(), {
  collapsed: false,
});

const { t } = useI18n();
const { logout, user } = useAuth();

const displayName = computed(() => user.value?.displayName?.trim() || '');
const email = computed(() => user.value?.email?.trim() || '');

/** Primary identity line: display name when set, otherwise email. */
const primaryLabel = computed(() => displayName.value || email.value);

/**
 * Secondary line only when a distinct display name is shown (avoid duplicating email).
 */
const secondaryEmail = computed(() => (displayName.value && email.value ? email.value : ''));

/** Single initial for avatar fallback (works for names and bare emails). */
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

/**
 * Account menu opened from UUser (expanded) or avatar (collapsed).
 * Logout lives here so the footer is a single control, not identity + separate row.
 */
const menuItems = computed<DropdownMenuItem[][]>(() => [
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
    :class="props.collapsed ? 'justify-center' : undefined"
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
        v-if="!props.collapsed && primaryLabel"
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
