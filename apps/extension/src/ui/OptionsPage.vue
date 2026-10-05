<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UFormField from '@nuxt/ui/components/FormField.vue';
import USelect from '@nuxt/ui/components/Select.vue';
import { useToast } from '@nuxt/ui/composables/useToast';
import { ApprovalService } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { useApprovalsEditor } from '../composables/use-approvals-editor.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { useExtensionTheme } from '../composables/use-extension-theme.js';
import { useTrackerActivity } from '../composables/use-tracker-activity.js';
import { reconcileWebsiteContentScripts } from '../content/registration.js';
import { SuggestionService, createChromeSuggestionStore } from '../suggestions/suggestions.js';
import BrandMark from './BrandMark.vue';
import DestinationApprovals from './DestinationApprovals.vue';
import SetupChecklist from './SetupChecklist.vue';
import SuggestionList from './SuggestionList.vue';
import { readSetupFocus } from './open-setup.js';
import WebsiteApprovals from './WebsiteApprovals.vue';

const { t, locale, setLocale, localeErrorKey } = useExtensionI18n();
const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const toast = useToast();
const suggestionService = new SuggestionService(createChromeSuggestionStore(), service);
/** A website or suggestion the popup handed over for approval (design D1). */
const focus = readSetupFocus(location.search);
const editor = useApprovalsEditor(service, {
  suggestions: suggestionService,
  onOutcome: (messageKey) =>
    toast.add({
      title: t.value(messageKey),
      color: 'success',
      icon: 'i-lucide-circle-check',
      duration: 4000,
    }),
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
  suggestions,
  approveSuggestion,
  dismissSuggestion,
} = editor;
const { theme, setTheme } = useExtensionTheme();
const { activity, now } = useTrackerActivity();
const themeItems = computed(() => [
  { label: t.value('app.themeLight'), value: 'light' as const, icon: 'i-lucide-sun' },
  { label: t.value('app.themeDark'), value: 'dark' as const, icon: 'i-lucide-moon' },
]);
const languageItems = computed(() => [
  { label: t.value('app.languageEn'), value: 'en' as const },
  { label: t.value('app.languagePl'), value: 'pl' as const },
]);
const version = chrome.runtime.getManifest().version;
const themeIcon = computed(() => (theme.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'));
const setupComplete = computed(() => websites.value.length > 0 && destinations.value.length > 0);
const disabled = computed(() => busy.value || !loaded.value);

onMounted(async () => {
  if (focus.website) websiteOrigin.value = focus.website;
  await refresh();
  if (!focus.website) return;
  // The popup handed this website over: the approve click here runs the permission prompt.
  await nextTick();
  document.querySelector<HTMLElement>('[data-testid="add-website"]')?.focus();
});
</script>

<template>
  <main
    class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 text-sm text-default"
    :aria-busy="busy"
  >
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex items-center gap-3">
        <BrandMark :size="40" />
        <div class="flex flex-col">
          <h1 class="text-xl font-semibold text-highlighted">{{ t('app.optionsTitle') }}</h1>
          <span class="text-[13px] text-muted">
            OSI Time Tracker
            <span class="before:me-1 before:content-['·']">{{ `v${version}` }}</span>
          </span>
        </div>
      </div>
      <div class="flex gap-2">
        <UFormField :label="t('app.language')" name="language" size="sm">
          <USelect
            id="language"
            :model-value="locale"
            :items="languageItems"
            value-key="value"
            icon="i-lucide-languages"
            size="sm"
            class="w-36"
            data-testid="language"
            @update:model-value="setLocale"
          />
        </UFormField>
        <UFormField :label="t('app.theme')" name="theme" size="sm">
          <USelect
            id="theme"
            :model-value="theme"
            :items="themeItems"
            value-key="value"
            :icon="themeIcon"
            size="sm"
            class="w-36"
            data-testid="theme"
            @update:model-value="setTheme"
          />
        </UFormField>
      </div>
    </header>

    <UAlert
      v-if="errorKey"
      role="alert"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      orientation="horizontal"
    >
      <template #description>
        <span data-testid="setup-error">{{ t(errorKey) }}</span>
      </template>
      <template #actions>
        <UButton
          data-testid="retry-setup"
          color="error"
          variant="outline"
          size="sm"
          :disabled="busy"
          :label="t('approvals.retry')"
          @click="retry()"
        />
      </template>
    </UAlert>
    <SetupChecklist
      v-else-if="loaded && !setupComplete"
      :website-done="websites.length > 0"
      :tracker-done="destinations.length > 0"
    />
    <UAlert
      v-if="localeErrorKey"
      role="alert"
      color="error"
      variant="subtle"
      :description="t(localeErrorKey)"
    />
    <UAlert
      v-if="missingOrigins.length"
      role="status"
      data-testid="missing-access"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('approvals.permissionMissing')"
      :description="t('approvals.missingPermission')"
    />
    <SuggestionList
      :suggestions="suggestions"
      :disabled="disabled"
      mode="setup"
      :highlight-id="focus.suggestion"
      @approve="approveSuggestion($event)"
      @dismiss="dismissSuggestion($event)"
    />
    <WebsiteApprovals
      :websites="websites"
      :destinations="destinations"
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
      :activity="activity"
      :now="now"
      @update:website="destinationWebsite = $event"
      @update:provider="destinationProvider = $event"
      @update:destination-url="destinationUrl = $event"
      @add="addDestination()"
      @revoke="revokeDestination($event)"
      @restore="restoreDestination($event)"
    />
  </main>
</template>
