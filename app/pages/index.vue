<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { getAuthStatusMessage } from '~/utils/authDisplay';

const { t } = useI18n();
const { loggedIn, user } = useAuth();

const statusLabel = computed(() => {
  const { key, params } = getAuthStatusMessage(loggedIn.value, user.value);
  return t(key, params ?? {});
});
</script>

<template>
  <section style="display: grid; gap: 1rem">
    <h2>{{ $t('home.welcome') }}</h2>
    <p data-testid="auth-status">{{ statusLabel }}</p>
  </section>
</template>
