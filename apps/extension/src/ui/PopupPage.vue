<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UAvatar from '@nuxt/ui/components/Avatar.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import { ApprovalService, destinationKey } from '../approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from '../approvals/chrome-store.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { useApprovalsEditor } from '../composables/use-approvals-editor.js';
import { SuggestionService, createChromeSuggestionStore } from '../suggestions/suggestions.js';
import { useTrackerActivity } from '../composables/use-tracker-activity.js';
import { formatActivity } from '../activity/format-activity.js';
import BrandMark from './BrandMark.vue';
import { openWebsite } from './open-website.js';
import SetupChecklist from './SetupChecklist.vue';
import SuggestionList from './SuggestionList.vue';
import { currentWebsiteOffer, openSetupPage } from './open-setup.js';

const { t, locale, localeErrorKey } = useExtensionI18n();
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

const needsAttention = computed(() => errorKey.value !== null || missingOrigins.value.length > 0);
const badge = computed(() =>
  needsAttention.value
    ? { label: t.value('app.statusAttention'), color: 'warning' as const }
    : { label: t.value('app.statusOk'), color: 'success' as const },
);
const setupComplete = computed(() => websites.value.length > 0 && destinations.value.length > 0);
const providerInitials = { openproject: 'OP', redmine: 'RM' } as const;

/** Website shown under a tracker row: just the host, the scheme is noise at popup width. */
const websiteHost = (origin: string) => new URL(origin).host;

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

const websiteOfferActions = computed(() => {
  const website = websiteOffer.value;
  if (!website) return [];
  return [
    {
      label: t.value('app.currentWebsiteApprove'),
      color: 'primary' as const,
      onClick: () => openSetupPage({ website }),
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
  <main class="flex w-90 flex-col bg-default text-sm text-default">
    <header class="flex items-center gap-2.5 border-b border-default px-4 py-3">
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
        :color="badge.color"
        variant="soft"
        :label="badge.label"
      />
    </header>

    <div class="flex flex-col gap-4 p-4">
      <UAlert
        v-if="errorKey"
        role="alert"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :description="t(errorKey)"
        :actions="[
          { label: t('approvals.retry'), color: 'error', variant: 'outline', onClick: refresh },
        ]"
      />
      <UAlert
        v-else-if="missingOrigins.length"
        role="alert"
        data-testid="popup-missing-access"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="t('approvals.permissionMissing')"
        :description="t('approvals.missingPermissionShort')"
      />
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
        v-if="websiteOffer"
        data-testid="current-website-offer"
        color="primary"
        variant="subtle"
        icon="i-lucide-globe"
        :title="t('app.currentWebsiteTitle', { website: websiteOffer })"
        :description="t('app.currentWebsiteHelp')"
        :actions="websiteOfferActions"
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
          class="flex flex-col gap-2"
          aria-labelledby="saved-websites-title"
          data-testid="saved-websites"
        >
          <h2 id="saved-websites-title" class="text-xs font-semibold text-muted">
            {{ t('approvals.savedWebsites') }}
          </h2>
          <ul
            v-if="websites.length"
            class="divide-y divide-default rounded-md ring ring-default ring-inset"
          >
            <li
              v-for="website in websites"
              :key="website.origin"
              class="flex items-center gap-2 px-3 py-2"
            >
              <UIcon name="i-lucide-globe" class="size-4 shrink-0 text-muted" />
              <ULink
                :to="website.origin"
                class="min-w-0 grow text-[13px] break-all text-highlighted hover:underline focus-visible:underline"
                data-testid="popup-website"
                @click.prevent="openWebsite(website.origin)"
              >
                {{ website.origin }}
              </ULink>
              <UBadge
                v-if="missingOrigins.includes(website.origin)"
                color="warning"
                variant="soft"
                size="sm"
                :label="t('approvals.noAccess')"
              />
            </li>
          </ul>
          <p v-else class="text-muted">{{ t('approvals.noWebsites') }}</p>
        </section>

        <section
          class="flex flex-col gap-2"
          aria-labelledby="saved-trackers-title"
          data-testid="saved-trackers"
        >
          <h2 id="saved-trackers-title" class="text-xs font-semibold text-muted">
            {{ t('approvals.savedTrackers') }}
          </h2>
          <ul
            v-if="destinations.length"
            class="divide-y divide-default rounded-md ring ring-default ring-inset"
          >
            <li
              v-for="destination in destinations"
              :key="destinationKey(destination)"
              class="flex items-center gap-2.5 px-3 py-2"
              data-testid="popup-tracker"
            >
              <UAvatar
                :text="providerInitials[destination.provider]"
                size="sm"
                class="rounded-md"
                aria-hidden="true"
              />
              <span class="flex min-w-0 grow flex-col">
                <ULink
                  :to="`${destination.origin}${destination.basePath}`"
                  target="_blank"
                  class="text-[13px] break-all text-highlighted hover:underline focus-visible:underline"
                >
                  <span data-testid="popup-tracker-url">
                    {{ destination.origin }}{{ destination.basePath }}
                  </span>
                  <span class="sr-only">({{ t('app.opensInNewTab') }})</span>
                </ULink>
                <span class="text-xs break-all text-muted" data-testid="popup-tracker-detail">
                  {{ t(`approvals.${destination.provider}`) }}
                  <span class="before:me-1 before:content-['·']">
                    {{ websiteHost(destination.websiteOrigin) }}
                  </span>
                </span>
                <span class="text-xs text-muted" data-testid="popup-tracker-activity">
                  <span class="sr-only">{{ t('activity.label') }}:</span>
                  {{ formatActivity(activity[destinationKey(destination)], now, locale, t) }}
                </span>
              </span>
              <UBadge
                v-if="missingOrigins.includes(destination.origin)"
                color="warning"
                variant="soft"
                size="sm"
                :label="t('approvals.noAccess')"
              />
            </li>
          </ul>
          <p v-else class="text-muted">{{ t('approvals.noDestinations') }}</p>
        </section>
      </template>
    </div>

    <footer class="border-t border-default px-4 py-3">
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
