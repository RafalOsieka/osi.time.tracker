<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { ApprovalService } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

const { t } = useExtensionI18n();
const websiteCount = shallowRef(0);
const destinationCount = shallowRef(0);
const status = computed(() => t.value('app.statusReady'));

onMounted(async () => {
  const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
  const state = await service.list();
  websiteCount.value = state.websites.length;
  destinationCount.value = state.destinations.length;
});

function openOptions(): void {
  chrome.runtime.openOptionsPage();
}
</script>

<template>
  <main class="popup">
    <h1 class="title">{{ t('app.popupTitle') }}</h1>
    <p class="status" role="status" aria-live="polite">{{ status }}</p>
    <p data-testid="approval-counts">{{ websiteCount }} / {{ destinationCount }}</p>
    <button class="button" data-testid="open-options" type="button" @click="openOptions">
      {{ t('app.openOptions') }}
    </button>
  </main>
</template>

<style scoped>
.popup {
  min-width: 18rem;
  padding: 1rem;
  font-family: system-ui, sans-serif;
  display: grid;
  gap: 0.75rem;
}
.title {
  font-size: 1.1rem;
  margin: 0;
}
.status {
  margin: 0;
}
.button {
  font: inherit;
}
</style>
