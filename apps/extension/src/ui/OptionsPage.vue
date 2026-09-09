<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ApprovalService } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { useApprovalsEditor } from '../composables/use-approvals-editor.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { reconcileWebsiteContentScripts } from '../content/registration.js';
import DestinationApprovals from './DestinationApprovals.vue';
import WebsiteApprovals from './WebsiteApprovals.vue';

const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const editor = useApprovalsEditor(service, {
  // Read inside the shared lock so another setup tab cannot apply an older script list last.
  reconcile: () =>
    navigator.locks.request('osi-extension-script-setup', async () => {
      const state = await service.list();
      const granted = await Promise.all(
        state.websites.map((item) => service.hasHostPermission(item.origin)),
      );
      await reconcileWebsiteContentScripts(
        state.websites.filter((_, index) => granted[index]).map((item) => item.origin),
      );
    }),
});
const {
  websites,
  destinations,
  websiteOrigin,
  destinationWebsite,
  destinationProvider,
  destinationUrl,
  statusKey,
  errorKey,
  websiteErrorKey,
  destinationErrorKey,
  missingOrigins,
  busy,
  loaded,
  httpWarning,
  refresh,
  addWebsite,
  revokeWebsite,
  addDestination,
  revokeDestination,
  restoreWebsite,
  restoreDestination,
  retry,
} = editor;
const { t, locale, setLocale, localeErrorKey } = useExtensionI18n();
const statusText = computed(() => t.value(errorKey.value ?? statusKey.value));
const disabled = computed(() => busy.value || !loaded.value);

function onLanguageChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  setLocale(target.value === 'pl' ? 'pl' : 'en');
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <main class="page">
    <header class="header">
      <h1 class="title">{{ t('app.optionsTitle') }}</h1>
      <label class="language">
        <span>{{ t('app.language') }}</span>
        <select data-testid="language" :value="locale" @change="onLanguageChange">
          <option value="en">{{ t('app.languageEn') }}</option>
          <option value="pl">{{ t('app.languagePl') }}</option>
        </select>
      </label>
    </header>
    <p class="status" data-testid="status" role="status" aria-live="polite">{{ statusText }}</p>
    <p v-if="localeErrorKey" role="alert">{{ t(localeErrorKey) }}</p>
    <button
      v-if="errorKey"
      data-testid="retry-setup"
      type="button"
      :disabled="busy"
      @click="retry()"
    >
      {{ t('approvals.retry') }}
    </button>
    <p v-if="missingOrigins.length" role="status">{{ t('approvals.missingPermission') }}</p>
    <p class="hint">{{ t('app.refreshHint') }}</p>
    <WebsiteApprovals
      :websites="websites"
      :origin="websiteOrigin"
      :disabled="disabled"
      :error-key="websiteErrorKey"
      :missing-origins="missingOrigins"
      @update:origin="websiteOrigin = $event"
      @add="addWebsite()"
      @revoke="revokeWebsite($event)"
      @restore="restoreWebsite($event)"
    />
    <DestinationApprovals
      :websites="websites"
      :destinations="destinations"
      :website="destinationWebsite"
      :provider="destinationProvider"
      :destination-url="destinationUrl"
      :http-warning="httpWarning"
      :disabled="disabled"
      :error-key="destinationErrorKey"
      :missing-origins="missingOrigins"
      @update:website="destinationWebsite = $event"
      @update:provider="destinationProvider = $event"
      @update:destination-url="destinationUrl = $event"
      @add="addDestination()"
      @revoke="revokeDestination($event)"
      @restore="restoreDestination($event)"
    />
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1.25rem;
  max-width: 40rem;
  margin: 0 auto;
  padding: 1rem;
  font-family: system-ui, sans-serif;
}
.header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}
.title {
  font-size: 1.25rem;
  margin: 0;
}
.language {
  display: grid;
  gap: 0.25rem;
}
.status,
.hint {
  margin: 0;
}
</style>
