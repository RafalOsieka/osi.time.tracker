<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="auth-layout">
    <section class="auth-layout__panel">
      <h1 class="auth-layout__title">{{ t('layout.title') }}</h1>
      <ColorModeToggle />
      <slot />
    </section>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  background: var(--p-content-background);
  padding: 1.5rem;
}

.auth-layout__panel {
  width: min(100%, 26rem);
  display: grid;
  gap: 1rem;
}

.auth-layout__title {
  margin: 0;
  color: var(--p-text-color);
}
</style>
