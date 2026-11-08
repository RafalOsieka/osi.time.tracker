<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import { ApprovalService, destinationKey } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { displayDestination, displayUrl } from '../approvals/display.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { useApprovalsEditor } from '../composables/use-approvals-editor.js';
import { SuggestionService, createChromeSuggestionStore } from '../suggestions/suggestions.js';
import { useTrackerActivity } from '../composables/use-tracker-activity.js';
import ActivityLine from './ActivityLine.vue';
import { errorTitleKey, missingAccessAlert } from './alerts.js';
import BrandMark from './BrandMark.vue';
import { extensionStatus, missingAccessItems, type ExtensionStatus } from './extension-status.js';
import { openWebsite } from './open-website.js';
import SetupChecklist from './SetupChecklist.vue';
import SuggestionList from './SuggestionList.vue';
import TrackerMark from './TrackerMark.vue';
import { currentWebsiteOffer, openSetupPage } from './open-setup.js';

const { t, localeErrorKey } = useExtensionI18n();
const { activity, now } = useTrackerActivity();
const service = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const {
  websites,
  destinations,
  missingOrigins,
  loaded,
  errorKey,
  refresh,
  busy,
  suggestions,
  dismissSuggestion,
} = useApprovalsEditor(service, {
  suggestions: new SuggestionService(createChromeSuggestionStore(), service),
});

const setupComplete = computed(() => websites.value.length > 0 && destinations.value.length > 0);
/** First use: the checklist leads and replaces the footer's generic way into setup. */
const onboarding = computed(() => loaded.value && !setupComplete.value);
const lostAccess = computed(() =>
  missingAccessItems(websites.value, destinations.value, missingOrigins.value),
);
const accessAlert = computed(() => missingAccessAlert(lostAccess.value, 'popup', t.value));

const status = computed(() =>
  extensionStatus({
    failed: errorKey.value !== null,
    missingAccess: lostAccess.value.length,
    pendingSuggestions: suggestions.value.length,
    setupComplete: setupComplete.value,
  }),
);
/**
 * How the badge shows each status: a label, a colour and an icon, never colour alone. Kept in
 * this file because the icon bundler only scans components for icon names.
 */
const STATUS_BADGES = {
  error: { labelKey: 'app.statusError', color: 'error', icon: 'i-lucide-circle-alert' },
  access: { labelKey: 'app.statusAccess', color: 'warning', icon: 'i-lucide-shield-alert' },
  review: { labelKey: 'app.statusReview', color: 'primary', icon: 'i-lucide-inbox' },
  setup: { labelKey: 'app.statusSetup', color: 'neutral', icon: 'i-lucide-circle-dashed' },
  ready: { labelKey: 'app.statusReady', color: 'success', icon: 'i-lucide-circle-check' },
} as const satisfies Record<ExtensionStatus, { labelKey: string; color: string; icon: string }>;
const badge = computed(() => STATUS_BADGES[status.value]);
/** Trackers name their website only when there is more than one to tell apart. */
const showsWebsite = computed(() => websites.value.length > 1);

/** The active tab's address, readable thanks to activeTab once the user opened the popup. */
const activeTabUrl = shallowRef<string | undefined>();
const websiteOffer = computed(() =>
  loaded.value
    ? currentWebsiteOffer(
        activeTabUrl.value,
        websites.value.map((item) => item.origin),
      )
    : null,
);

const errorActions = computed(() => [
  {
    label: t.value('approvals.retry'),
    icon: 'i-lucide-rotate-cw',
    color: 'error' as const,
    disabled: busy.value,
    onClick: () => refresh(),
  },
]);

/** The popup never requests permissions itself: restoring continues on the setup page. */
const accessActions = computed(() => {
  const [first] = lostAccess.value;
  if (!first) return [];
  return [
    {
      label: t.value('approvals.restorePermission'),
      trailingIcon: 'i-lucide-arrow-up-right',
      color: 'warning' as const,
      onClick: () => openSetupPage({ restore: first.focus }),
    },
  ];
});

onMounted(() => {
  void refresh();
  void chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(([tab]) => {
      activeTabUrl.value = tab?.url;
    })
    .catch(() => {
      // Without the tab's address the popup simply makes no offer.
    });
});

function openOptions(): void {
  chrome.runtime.openOptionsPage();
}
</script>

<template>
  <main class="flex max-h-150 w-90 flex-col text-sm text-default">
    <header class="flex shrink-0 items-center gap-3 border-b border-default bg-default px-4 py-3">
      <BrandMark :size="28" />
      <div class="flex min-w-0 grow flex-col">
        <h1 class="text-sm font-semibold text-highlighted">OSI Time Tracker</h1>
        <span class="text-xs text-muted">{{ t('app.popupTitle') }}</span>
      </div>
      <UBadge
        v-if="loaded || errorKey"
        role="status"
        aria-live="polite"
        data-testid="popup-status"
        :data-status="status"
        class="shrink-0"
        :color="badge.color"
        variant="soft"
        :icon="badge.icon"
        :label="t(badge.labelKey, { count: suggestions.length })"
      />
    </header>

    <div class="min-h-0 grow overflow-y-auto [scrollbar-width:thin]">
      <div class="flex flex-col gap-3 p-4">
        <UAlert
          v-if="errorKey"
          role="alert"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="t(errorTitleKey(errorKey))"
          :description="t(errorKey)"
          :actions="errorActions"
        />
        <UAlert
          v-if="localeErrorKey"
          role="alert"
          color="error"
          variant="subtle"
          icon="i-lucide-languages"
          :description="t(localeErrorKey)"
        />
        <UAlert
          v-if="accessAlert"
          role="alert"
          data-testid="popup-missing-access"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          :title="accessAlert.title"
          :description="accessAlert.description"
          :actions="accessActions"
        />

        <UCard v-if="websiteOffer" data-testid="current-website-offer" :ui="{ body: 'p-4' }">
          <div class="flex items-start gap-3">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-100/80 text-primary dark:bg-primary/16"
              aria-hidden="true"
            >
              <UIcon name="i-lucide-globe" class="size-4.5" />
            </span>
            <div class="flex min-w-0 flex-col items-start">
              <h2 class="text-sm font-semibold text-highlighted">
                {{ t('app.currentWebsiteTitle') }}
              </h2>
              <p class="max-w-full truncate font-medium text-toned">
                {{ displayUrl(websiteOffer) }}
              </p>
              <p class="mt-1 text-[13px] text-muted">{{ t('app.currentWebsiteHelp') }}</p>
              <UButton
                class="mt-3"
                size="sm"
                trailing-icon="i-lucide-arrow-up-right"
                data-testid="current-website-approve"
                :label="t('app.currentWebsiteApprove')"
                @click="openSetupPage({ website: websiteOffer })"
              />
            </div>
          </div>
        </UCard>

        <SetupChecklist
          v-if="onboarding && !errorKey"
          mode="popup"
          :website-done="websites.length > 0"
          :tracker-done="destinations.length > 0"
          :website-action-hidden="websiteOffer !== null"
          @act="openSetupPage({ step: $event })"
        />

        <template v-if="loaded">
          <SuggestionList
            :suggestions="suggestions"
            :disabled="busy"
            mode="popup"
            @dismiss="dismissSuggestion($event)"
            @review="openSetupPage({ suggestion: $event })"
          />

          <section
            v-if="websites.length"
            class="flex flex-col gap-2"
            aria-labelledby="saved-websites-title"
            data-testid="saved-websites"
          >
            <h2 id="saved-websites-title" class="px-1 text-xs font-medium text-muted">
              {{ t('approvals.websitesTitle') }}
            </h2>
            <ul
              class="divide-y divide-default overflow-hidden rounded-md bg-default ring ring-default dark:bg-muted"
            >
              <li
                v-for="website in websites"
                :key="website.origin"
                class="flex min-h-11 items-center gap-3 px-3 py-2"
              >
                <span
                  class="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded bg-primary-100/80 text-primary dark:bg-primary/16"
                  aria-hidden="true"
                >
                  <UIcon name="i-lucide-globe" class="size-3.5" />
                </span>
                <ULink
                  :to="website.origin"
                  class="group inline-flex min-w-0 items-center gap-1 font-medium text-highlighted hover:text-primary focus-visible:text-primary"
                  data-testid="popup-website"
                  @click.prevent="openWebsite(website.origin)"
                >
                  <span class="truncate group-hover:underline">
                    {{ displayUrl(website.origin) }}
                  </span>
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
                    aria-hidden="true"
                  />
                </ULink>
                <UBadge
                  v-if="missingOrigins.includes(website.origin)"
                  class="ms-auto shrink-0"
                  color="warning"
                  variant="soft"
                  size="sm"
                  :label="t('approvals.noAccess')"
                />
              </li>
            </ul>
          </section>

          <section
            v-if="destinations.length"
            class="flex flex-col gap-2"
            aria-labelledby="saved-trackers-title"
            data-testid="saved-trackers"
          >
            <h2 id="saved-trackers-title" class="px-1 text-xs font-medium text-muted">
              {{ t('approvals.destinationsTitle') }}
            </h2>
            <ul
              class="divide-y divide-default overflow-hidden rounded-md bg-default ring ring-default dark:bg-muted"
            >
              <li
                v-for="destination in destinations"
                :key="destinationKey(destination)"
                class="flex items-start gap-3 px-3 py-2.5"
                data-testid="popup-tracker"
              >
                <TrackerMark :provider="destination.provider" class="mt-px" />
                <span class="flex min-w-0 grow flex-col gap-0.5">
                  <span class="flex min-w-0 items-center gap-2">
                    <ULink
                      :to="`${destination.origin}${destination.basePath}`"
                      target="_blank"
                      class="group inline-flex min-w-0 items-center gap-1 font-medium text-highlighted hover:text-primary focus-visible:text-primary"
                    >
                      <span class="truncate group-hover:underline" data-testid="popup-tracker-url">
                        {{ displayDestination(destination) }}
                      </span>
                      <UIcon
                        name="i-lucide-external-link"
                        class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
                        aria-hidden="true"
                      />
                      <span class="sr-only">
                        {{ t(`approvals.${destination.provider}`) }} ({{ t('app.opensInNewTab') }})
                      </span>
                    </ULink>
                    <UBadge
                      v-if="missingOrigins.includes(destination.origin)"
                      class="ms-auto shrink-0"
                      color="warning"
                      variant="soft"
                      size="sm"
                      :label="t('approvals.noAccess')"
                    />
                  </span>
                  <span
                    v-if="showsWebsite"
                    class="truncate text-xs text-muted"
                    data-testid="popup-tracker-website"
                  >
                    {{
                      t('approvals.websiteLine', { website: displayUrl(destination.websiteOrigin) })
                    }}
                  </span>
                  <ActivityLine
                    :record="activity[destinationKey(destination)]"
                    :now="now"
                    data-testid="popup-tracker-activity"
                  />
                </span>
              </li>
            </ul>
          </section>
        </template>
      </div>
    </div>

    <footer v-if="!onboarding" class="shrink-0 border-t border-default bg-default px-4 py-3">
      <UButton
        block
        color="neutral"
        variant="outline"
        icon="i-lucide-settings-2"
        data-testid="open-options"
        :label="t('app.openOptions')"
        @click="openOptions"
      />
    </footer>
  </main>
</template>
