<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { DropdownMenuItem } from '@nuxt/ui';

const { t } = useI18n();
const { logout, user } = useAuth();

const avatarLabel = computed(() => {
  const name = user.value?.displayName?.trim() || user.value?.email?.trim();
  const firstLetter = name?.[0];
  return firstLetter ? firstLetter.toUpperCase() : '?';
});

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

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('utilityMenu.logout'),
      icon: 'i-lucide-log-out',
      color: 'error' as const,
      disabled: pending.value,
      onSelect: () => {
        void onLogout();
      },
      kbds: undefined,
    },
  ],
]);
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }" data-testid="utility-menu">
    <UButton
      color="primary"
      variant="solid"
      class="rounded-full"
      square
      :aria-label="t('utilityMenu.label')"
      data-testid="utility-menu-button"
    >
      {{ avatarLabel }}
    </UButton>
  </UDropdownMenu>
</template>
