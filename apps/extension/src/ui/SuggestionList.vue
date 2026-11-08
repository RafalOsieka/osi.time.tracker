<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import { displayDestination, displayUrl } from '../approvals/display.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { canonicalizeDestination, isHttpCredentialRisk } from '../security/canonicalize.js';
import { suggestionId, type DestinationSuggestion } from '../suggestions/suggestions.js';
import TrackerMark from './TrackerMark.vue';

/**
 * Trackers that approved websites asked the user to approve (REQ-416), as a titled section with
 * its count. The setup page approves them in place (the click runs the permission prompt); the
 * popup only dismisses or hands over to setup. A plain-HTTP tracker says so under its address,
 * and its approval is worded as a deliberate exception.
 */
const {
  suggestions,
  disabled,
  mode,
  highlightId = null,
} = defineProps<{
  suggestions: readonly DestinationSuggestion[];
  disabled: boolean;
  mode: 'setup' | 'popup';
  highlightId?: string | null;
}>();

const emit = defineEmits<{
  approve: [id: string];
  review: [id: string];
  dismiss: [id: string];
}>();

const { t } = useExtensionI18n();

/**
 * The website every pending suggestion comes from, when they all share one: the section then
 * names it once instead of on every row (REQ-416).
 */
const commonWebsite = computed(() => {
  const [first, ...rest] = suggestions;
  return first && rest.every((item) => item.websiteOrigin === first.websiteOrigin)
    ? first.websiteOrigin
    : null;
});

function sendsCredentialsInClear(item: DestinationSuggestion): boolean {
  return isHttpCredentialRisk(canonicalizeDestination(`${item.origin}${item.basePath}`));
}

// The popup handed this suggestion over: put focus on its approve action once it is listed, or
// on its dismiss action when approving would accept an unencrypted tracker (focus never lands on
// a risky action by default). Client only: focus means nothing while rendering on a server.
let focusedHighlight = false;
onMounted(() =>
  watch(
    () => suggestions.find((item) => suggestionId(item) === highlightId),
    async (item) => {
      if (!item || mode !== 'setup' || focusedHighlight) return;
      focusedHighlight = true;
      await nextTick();
      const action = sendsCredentialsInClear(item) ? 'dismiss' : 'approve';
      document
        .querySelector<HTMLElement>(
          `[data-testid="${action}-suggestion-${CSS.escape(suggestionId(item))}"]`,
        )
        ?.focus();
    },
    { immediate: true },
  ),
);
</script>

<template>
  <component
    :is="mode === 'setup' ? UCard : 'section'"
    v-if="suggestions.length"
    aria-labelledby="suggestions-title"
    data-testid="suggestions"
    v-bind="mode === 'setup' ? { as: 'section', ui: { body: 'p-0 sm:p-0' } } : {}"
    :class="mode === 'popup' ? 'flex flex-col gap-2' : ''"
  >
    <template v-if="mode === 'setup'" #header>
      <div class="flex items-center gap-2">
        <h2 id="suggestions-title" class="text-base font-semibold text-highlighted">
          {{ t('approvals.suggestionsTitle') }}
        </h2>
        <UBadge
          color="primary"
          variant="soft"
          size="sm"
          class="tabular-nums"
          :label="String(suggestions.length)"
          data-testid="suggestions-count"
        />
      </div>
      <p class="mt-0.5 text-sm text-muted">{{ t('approvals.suggestionsHelp') }}</p>
      <p v-if="commonWebsite" class="mt-0.5 text-sm text-muted" data-testid="suggestions-website">
        {{ t('approvals.suggestedByAll', { website: displayUrl(commonWebsite) }) }}
      </p>
    </template>
    <!-- In the popup every section is a label above a list, as for the approved ones; the
      header status badge already carries the count. -->
    <div v-if="mode === 'popup'" class="flex flex-col px-1">
      <h2 id="suggestions-title" class="text-xs font-medium text-muted">
        {{ t('approvals.suggestionsTitle') }}
      </h2>
      <p v-if="commonWebsite" class="text-xs text-muted" data-testid="suggestions-website">
        {{ t('approvals.suggestedByAll', { website: displayUrl(commonWebsite) }) }}
      </p>
    </div>

    <ul
      class="divide-y divide-default"
      :class="
        mode === 'popup'
          ? 'overflow-hidden rounded-lg bg-default ring ring-default dark:bg-muted'
          : ''
      "
    >
      <li
        v-for="item in suggestions"
        :key="suggestionId(item)"
        class="flex gap-3"
        :class="[
          mode === 'popup' ? 'flex-col px-4 py-3' : 'flex-wrap items-center px-4 py-3 sm:px-6',
          suggestionId(item) === highlightId ? 'bg-elevated' : '',
        ]"
        :data-highlighted="suggestionId(item) === highlightId || undefined"
        :data-testid="`suggestion-${suggestionId(item)}`"
      >
        <div class="flex min-w-0 items-start gap-3" :class="mode === 'setup' ? 'flex-1' : ''">
          <TrackerMark :provider="item.provider" class="mt-0.5" />
          <div
            class="flex min-w-0 flex-col gap-0.5"
            :class="mode === 'popup' ? 'text-[13px]' : 'text-sm'"
          >
            <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span class="min-w-0 truncate text-sm font-medium text-highlighted">
                {{ displayDestination(item) }}
                <span class="sr-only">({{ t(`approvals.${item.provider}`) }})</span>
              </span>
              <UBadge
                v-if="suggestionId(item) === highlightId"
                color="neutral"
                variant="outline"
                size="sm"
                class="shrink-0"
                :label="t('approvals.reviewedTag')"
                data-testid="suggestion-reviewed"
              />
            </span>
            <span v-if="!commonWebsite" class="text-muted">
              {{ t('approvals.suggestedBy', { website: displayUrl(item.websiteOrigin) }) }}
            </span>
            <p
              v-if="mode === 'popup' && sendsCredentialsInClear(item)"
              class="flex items-center gap-1.5 font-medium text-warning"
              :data-testid="`http-suggestion-${suggestionId(item)}`"
            >
              <UIcon name="i-lucide-lock-open" class="size-3.5 shrink-0" />
              {{ t('approvals.httpShort') }}
            </p>
          </div>
        </div>
        <!-- Popup actions start at the text column, like every other popup action. -->
        <div class="flex shrink-0 gap-2" :class="mode === 'popup' ? 'ps-9' : ''">
          <UButton
            v-if="mode === 'setup'"
            :color="sendsCredentialsInClear(item) ? 'warning' : 'primary'"
            :variant="sendsCredentialsInClear(item) ? 'outline' : 'solid'"
            icon="i-lucide-check"
            :disabled="disabled"
            :label="
              t(
                sendsCredentialsInClear(item)
                  ? 'approvals.approveDespiteHttp'
                  : 'approvals.approveSuggestion',
              )
            "
            :aria-label="`${t('approvals.approveSuggestion')} ${displayDestination(item)}`"
            :data-testid="`approve-suggestion-${suggestionId(item)}`"
            @click="emit('approve', suggestionId(item))"
          />
          <UButton
            v-else
            color="primary"
            variant="soft"
            trailing-icon="i-lucide-arrow-up-right"
            :disabled="disabled"
            :label="t('approvals.reviewSuggestion')"
            :aria-label="`${t('approvals.reviewSuggestion')} ${displayDestination(item)}`"
            :data-testid="`review-suggestion-${suggestionId(item)}`"
            @click="emit('review', suggestionId(item))"
          />
          <UButton
            color="neutral"
            variant="outline"
            :disabled="disabled"
            :label="t('approvals.dismissSuggestion')"
            :aria-label="`${t('approvals.dismissSuggestion')} ${displayDestination(item)}`"
            :data-testid="`dismiss-suggestion-${suggestionId(item)}`"
            @click="emit('dismiss', suggestionId(item))"
          />
        </div>
        <!-- On the setup page the risk spans the row, under the address and its actions. -->
        <p
          v-if="mode === 'setup' && sendsCredentialsInClear(item)"
          class="flex basis-full items-start gap-2 ps-9 text-sm text-toned"
          :data-testid="`http-suggestion-${suggestionId(item)}`"
        >
          <UIcon
            name="i-lucide-lock-open"
            class="mt-0.5 size-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <span>
            <span class="font-medium text-warning">
              {{ t('approvals.httpTitle') }}
            </span>
            {{ t('approvals.httpWarning') }}
          </span>
        </p>
      </li>
    </ul>
  </component>
</template>
