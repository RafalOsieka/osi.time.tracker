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
    <template v-if="loaded">
      <section aria-labelledby="saved-websites-title" data-testid="saved-websites">
        <h2 id="saved-websites-title" class="list-title">{{ t('approvals.savedWebsites') }}</h2>
        <ul v-if="websites.length" class="approval-list">
          <li v-for="website in websites" :key="website.origin">{{ website.origin }}</li>
        </ul>
        <p v-else class="empty">{{ t('approvals.noWebsites') }}</p>
      </section>
      <section aria-labelledby="saved-trackers-title" data-testid="saved-trackers">
        <h2 id="saved-trackers-title" class="list-title">{{ t('approvals.savedTrackers') }}</h2>
        <ul v-if="destinations.length" class="approval-list">
          <li
            v-for="destination in destinations"
            :key="`${destination.websiteOrigin}|${destination.provider}|${destination.origin}${destination.basePath}`"
          >
            {{ destination.websiteOrigin }} - {{ destination.origin }}{{ destination.basePath }}
          </li>
        </ul>
        <p v-else class="empty">{{ t('approvals.noDestinations') }}</p>
      </section>
    </template>
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
.list-title {
  font-size: 1rem;
  margin: 0;
}
.approval-list {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  overflow-wrap: anywhere;
}
.empty {
  margin: 0.5rem 0 0;
}
.button {
  font: inherit;
}
</style>
