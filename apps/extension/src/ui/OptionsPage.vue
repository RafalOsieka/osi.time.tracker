<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UButton from '@nuxt/ui/components/Button.vue';
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
import { errorTitleKey, missingAccessAlert } from './alerts.js';
import { missingAccessItems } from './extension-status.js';
import SetupChecklist from './SetupChecklist.vue';
import SuggestionList from './SuggestionList.vue';
import { readSetupFocus, type SetupStep } from './open-setup.js';
import WebsiteApprovals from './WebsiteApprovals.vue';

const { t, locale, setLocale, localeErrorKey } = useExtensionI18n();
const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const toast = useToast();
const suggestionService = new SuggestionService(createChromeSuggestionStore(), service);
/** What the popup handed over: a website, a suggestion, a step's form or a restore (design D1). */
const focus = readSetupFocus(location.search);
const editor = useApprovalsEditor(service, {
  suggestions: suggestionService,
  onOutcome: (messageKey, params) =>
    toast.add({
      title: t.value(messageKey, params),
      color: 'success',
      icon: 'i-lucide-circle-check',
      duration: 4000,
      progress: false,
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
/** Saved settings could not be read: nothing below may pose as an empty configuration. */
const unreadable = computed(() => errorKey.value === 'approvals.loadFailed' && !loaded.value);

/** Add forms expanded on request; each one is always open while its list is empty. */
const websiteFormOpen = shallowRef(focus.website !== undefined);
const destinationFormOpen = shallowRef(focus.step === 'tracker');

// A completed approval folds its form away again; the editor clears the field once it saved.
async function submitWebsite(): Promise<void> {
  await addWebsite();
  if (websiteOrigin.value === '' && !websiteErrorKey.value && !errorKey.value) {
    websiteFormOpen.value = false;
  }
}

async function submitDestination(): Promise<void> {
  await addDestination();
  if (destinationUrl.value === '' && !destinationErrorKey.value && !errorKey.value) {
    destinationFormOpen.value = false;
  }
}

const lostAccess = computed(() =>
  missingAccessItems(websites.value, destinations.value, missingOrigins.value),
);
const accessAlert = computed(() => missingAccessAlert(lostAccess.value, 'setup', t.value));
/** One lost approval is restored right from the alert; several are restored row by row. */
const restorable = computed(() => lostAccess.value.length === 1);

async function restoreOnly(): Promise<void> {
  const [only] = lostAccess.value;
  if (!only) return;
  if (only.kind === 'website') await restoreWebsite(only.origin);
  else await restoreDestination(only.approval);
}

/** Moves focus to a field or control once it is on the page. */
async function focusTestId(testId: string): Promise<void> {
  await nextTick();
  document.querySelector<HTMLElement>(`[data-testid="${CSS.escape(testId)}"]`)?.focus();
}

function goToStep(step: SetupStep): void {
  if (step === 'tracker') destinationFormOpen.value = true;
  void focusTestId(step === 'website' ? 'website-origin' : 'destination-url');
}

onMounted(async () => {
  if (focus.website) websiteOrigin.value = focus.website;
  await refresh();
  // The popup handed this over: the click here runs the permission prompt.
  if (focus.website) await focusTestId('add-website');
  else if (focus.step) goToStep(focus.step);
  else if (focus.restore) await focusTestId(`restore-${focus.restore}`);
});
</script>

<template>
  <main
    class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6 pb-12 text-sm text-default"
    :aria-busy="busy"
  >
    <div class="flex items-center justify-between gap-4 border-b border-default pb-4">
      <div class="flex items-center gap-2.5">
        <BrandMark :size="24" />
        <span class="text-sm font-semibold text-highlighted">OSI Time Tracker</span>
        <span class="text-xs text-muted tabular-nums">{{ `v${version}` }}</span>
      </div>
      <div class="flex gap-2">
        <USelect
          id="language"
          :model-value="locale"
          :items="languageItems"
          value-key="value"
          icon="i-lucide-languages"
          size="sm"
          class="w-32"
          :aria-label="t('app.language')"
          data-testid="language"
          @update:model-value="setLocale"
        />
        <USelect
          id="theme"
          :model-value="theme"
          :items="themeItems"
          value-key="value"
          :icon="themeIcon"
          size="sm"
          class="w-32"
          :aria-label="t('app.theme')"
          data-testid="theme"
          @update:model-value="setTheme"
        />
      </div>
    </div>

    <header class="flex flex-col gap-1">
      <h1 class="m-0 text-[1.375rem]/8 font-semibold tracking-tight text-highlighted">
        {{ t('app.optionsTitle') }}
      </h1>
      <p class="text-sm text-muted">{{ t('app.purpose') }}</p>
    </header>

    <UAlert
      v-if="errorKey"
      role="alert"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      orientation="horizontal"
      :title="t(errorTitleKey(errorKey))"
    >
      <template #description>
        <span data-testid="setup-error">{{ t(errorKey) }}</span>
      </template>
      <template #actions>
        <UButton
          data-testid="retry-setup"
          color="error"
          size="sm"
          icon="i-lucide-rotate-cw"
          :disabled="busy"
          :label="t('approvals.retry')"
          @click="retry()"
        />
      </template>
    </UAlert>
    <UAlert
      v-if="localeErrorKey"
      role="alert"
      color="error"
      variant="subtle"
      icon="i-lucide-languages"
      :description="t(localeErrorKey)"
    />

    <template v-if="!unreadable && loaded">
      <UAlert
        v-if="accessAlert"
        role="status"
        data-testid="missing-access"
        color="warning"
        variant="subtle"
        icon="i-lucide-shield-alert"
        orientation="horizontal"
        :title="accessAlert.title"
        :description="accessAlert.description"
      >
        <template v-if="restorable" #actions>
          <UButton
            data-testid="missing-access-restore"
            color="warning"
            size="sm"
            icon="i-lucide-shield-check"
            :disabled="disabled"
            :label="t('approvals.restorePermission')"
            @click="restoreOnly()"
          />
        </template>
      </UAlert>
      <SetupChecklist
        v-if="!setupComplete"
        mode="setup"
        :website-done="websites.length > 0"
        :tracker-done="destinations.length > 0"
        @act="goToStep"
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
        v-model:open="websiteFormOpen"
        :websites="websites"
        :destinations="destinations"
        :origin="websiteOrigin"
        :handed-off="focus.website !== undefined && websiteOrigin === focus.website"
        :disabled="disabled"
        :error-key="websiteErrorKey"
        :missing-origins="missingOrigins"
        @update:origin="websiteOrigin = $event"
        @add="submitWebsite()"
        @revoke="revokeWebsite($event)"
        @restore="restoreWebsite($event)"
      />
      <DestinationApprovals
        v-model:open="destinationFormOpen"
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
        @add="submitDestination()"
        @revoke="revokeDestination($event)"
        @restore="restoreDestination($event)"
      />
    </template>
  </main>
</template>
