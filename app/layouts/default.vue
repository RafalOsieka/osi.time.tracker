<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { logout } = useAuth();

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
</script>

<template>
  <div>
    <header
      style="
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--p-content-border-color, #e5e7eb);
      "
    >
      <strong>{{ t('layout.title') }}</strong>

      <!-- Reserved slot for future nav items and the running-timer indicator. -->
      <nav style="display: flex; gap: 1rem; flex: 1" />

      <Button
        data-testid="logout-button"
        :label="t('layout.logoutButton')"
        severity="secondary"
        :loading="pending"
        @click="onLogout"
      />
    </header>

    <main style="padding: 1rem">
      <slot />
    </main>
  </div>
</template>
