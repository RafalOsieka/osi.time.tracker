<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ApprovalService } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { useApprovalsEditor } from '../composables/use-approvals-editor.js';

const { t, localeErrorKey } = useExtensionI18n();
const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const { websites, destinations, missingOrigins, loaded, errorKey, refresh } =
  useApprovalsEditor(service);
const status = computed(() =>
  t.value(
    errorKey.value ??
      (missingOrigins.value.length ? 'approvals.missingPermission' : 'app.statusReady'),
  ),
);

onMounted(() => {
  void refresh();
});

function openOptions(): void {
  chrome.runtime.openOptionsPage();
}
</script>

<template>
  <main class="popup">
    <h1 class="title">{{ t('app.popupTitle') }}</h1>
    <p class="status" role="status" aria-live="polite">{{ status }}</p>
    <p v-if="localeErrorKey" role="alert">{{ t(localeErrorKey) }}</p>
    <p v-if="loaded" data-testid="approval-counts">
      {{ t('approvals.savedCounts') }} {{ websites.length }} / {{ destinations.length }}
    </p>
    <button v-if="errorKey" type="button" @click="refresh()">{{ t('approvals.retry') }}</button>
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
