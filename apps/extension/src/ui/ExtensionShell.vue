<script setup lang="ts">
import { computed } from 'vue';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

const { titleKey, statusKey } = defineProps<{
  titleKey: string;
  statusKey: string;
}>();

const { t } = useExtensionI18n();
const title = computed(() => t.value(titleKey));
const status = computed(() => t.value(statusKey));
</script>

<template>
  <main class="shell">
    <h1 class="shell-title">{{ title }}</h1>
    <p class="shell-status" role="status" aria-live="polite">{{ status }}</p>
  </main>
</template>

<style scoped>
.shell {
  font-family: system-ui, sans-serif;
  margin: 0;
  padding: 1rem;
  max-width: 40rem;
}

.shell-title {
  font-size: 1.25rem;
  margin: 0 0 0.75rem;
}

.shell-status {
  margin: 0;
}
</style>
