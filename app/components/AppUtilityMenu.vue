<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t, locale, availableLocales } = useI18n();
const { preference, setPreference } = useColorMode();
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

const localeOptions = computed(() =>
  availableLocales.map((code) => ({ value: code, label: t(`locale.${code}`) })),
);

const themeOptions = computed(() => [
  { value: 'light', label: t('theme.light') },
  { value: 'dark', label: t('theme.dark') },
  { value: 'system', label: t('theme.system') },
]);

const selectedLocale = computed({
  get: () => locale.value,
  set: (val) => {
    locale.value = val;
  },
});

const selectedTheme = computed({
  get: () => preference.value,
  set: (val) => setPreference(val as 'light' | 'dark' | 'system'),
});

const menu = ref();
const menuItems = computed(() => [
  { key: 'locale' },
  { key: 'theme' },
  { separator: true },
  {
    label: t('utilityMenu.logout'),
    command: onLogout,
  },
]);

function toggleMenu(event: Event) {
  menu.value.toggle(event);
}
</script>

<template>
  <Avatar
    :label="avatarLabel"
    shape="circle"
    class="app-utility-menu__avatar"
    :aria-label="t('utilityMenu.label')"
    data-testid="utility-menu-button"
    role="button"
    tabindex="0"
    @click="toggleMenu"
    @keydown.enter.space.prevent="toggleMenu"
  />
  <Menu ref="menu" :model="menuItems" popup data-testid="utility-menu">
    <template #item="{ item }">
      <div v-if="item.key === 'locale'" class="app-utility-menu__select-row">
        <label for="utility-locale-select" class="app-utility-menu__select-label">
          {{ t('utilityMenu.locale') }}
        </label>
        <Select
          id="utility-locale-select"
          v-model="selectedLocale"
          :options="localeOptions"
          option-label="label"
          option-value="value"
          class="app-utility-menu__select"
          size="small"
          @click.stop
        />
      </div>
      <div v-else-if="item.key === 'theme'" class="app-utility-menu__select-row">
        <label for="utility-theme-select" class="app-utility-menu__select-label">
          {{ t('utilityMenu.theme') }}
        </label>
        <Select
          id="utility-theme-select"
          v-model="selectedTheme"
          :options="themeOptions"
          option-label="label"
          option-value="value"
          class="app-utility-menu__select"
          size="small"
          @click.stop
        />
      </div>
      <a
        v-else
        class="p-menu-item-link"
        role="menuitem"
        tabindex="0"
        @click="item.command?.($event)"
        @keydown.enter.space.prevent="item.command?.($event)"
      >
        <span class="p-menu-item-label">{{ item.label }}</span>
      </a>
    </template>
  </Menu>
</template>

<style scoped>
.app-utility-menu__avatar {
  cursor: pointer;
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.app-utility-menu__select-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.app-utility-menu__select-label {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: var(--p-text-color);
  min-width: 4rem;
}

.app-utility-menu__select {
  flex: 1;
  font-size: 0.875rem;
}
</style>
