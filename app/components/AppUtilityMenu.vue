<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { DropdownMenuItem } from '@nuxt/ui';

type ColorModePreference = 'light' | 'dark' | 'system';

const { t, locale, availableLocales, setLocale } = useI18n();
const colorMode = useColorMode();
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
      label: t('utilityMenu.locale'),
      type: 'label',
    },
    ...availableLocales.map((code) => ({
      label: t(`locale.${code}`),
      type: 'checkbox' as const,
      checked: locale.value === code,
      onSelect: () => {
        void setLocale(code);
      },
    })),
  ],
  [
    {
      label: t('utilityMenu.theme'),
      type: 'label',
    },
    ...(
      [
        { value: 'light', label: t('theme.light') },
        { value: 'dark', label: t('theme.dark') },
        { value: 'system', label: t('theme.system') },
      ] as Array<{ value: ColorModePreference; label: string }>
    ).map((option) => ({
      label: option.label,
      type: 'checkbox' as const,
      checked: colorMode.preference === option.value,
      onSelect: () => {
        colorMode.preference = option.value;
      },
    })),
  ],
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
