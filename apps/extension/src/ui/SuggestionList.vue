<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue';
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
 * popup only dismisses or hands over to setup. A plain-HTTP tracker says so before approval.
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

function sendsCredentialsInClear(item: DestinationSuggestion): boolean {
  return isHttpCredentialRisk(canonicalizeDestination(`${item.origin}${item.basePath}`));
}

// The popup handed this suggestion over: put focus on its approve action once it is listed.
// Client only: focus means nothing while rendering on a server.
let focusedHighlight = false;
onMounted(() =>
  watch(
    () => suggestions.some((item) => suggestionId(item) === highlightId),
    async (listed) => {
      if (!listed || mode !== 'setup' || focusedHighlight) return;
      focusedHighlight = true;
      await nextTick();
      document
        .querySelector<HTMLElement>(
          `[data-testid="approve-suggestion-${CSS.escape(highlightId ?? '')}"]`,
        )
        ?.focus();
    },
    { immediate: true },
  ),
);
</script>

<template>
  <UCard
    v-if="suggestions.length"
    as="section"
    aria-labelledby="suggestions-title"
    data-testid="suggestions"
    :ui="{ header: mode === 'popup' ? 'px-4 py-3 sm:px-4' : undefined, body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <h2
          id="suggestions-title"
          class="font-semibold text-highlighted"
          :class="mode === 'popup' ? 'text-sm' : 'text-base'"
        >
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
      <p v-if="mode === 'setup'" class="mt-1 text-[13px] text-muted">
        {{ t('approvals.suggestionsHelp') }}
      </p>
    </template>

    <ul class="divide-y divide-default">
      <li
        v-for="item in suggestions"
        :key="suggestionId(item)"
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2"
        :class="[
          mode === 'popup' ? 'px-4 py-2.5' : 'px-4 py-3 sm:px-6',
          suggestionId(item) === highlightId ? 'bg-primary-50/80 dark:bg-primary/8' : '',
        ]"
        :data-highlighted="suggestionId(item) === highlightId || undefined"
        :data-testid="`suggestion-${suggestionId(item)}`"
      >
        <TrackerMark :provider="item.provider" class="row-start-1" />
        <span
          class="row-start-1 flex min-w-0 flex-col"
          :class="mode === 'popup' ? 'col-span-2' : ''"
        >
          <span class="truncate font-medium text-highlighted">
            {{ displayDestination(item) }}
          </span>
          <span class="truncate text-xs text-muted">
            {{ t(`approvals.${item.provider}`) }}
            <span class="before:me-1 before:content-['·']">
              {{ t('approvals.suggestedBy', { website: displayUrl(item.websiteOrigin) }) }}
            </span>
          </span>
        </span>
        <p
          v-if="sendsCredentialsInClear(item)"
          class="col-start-2 row-start-2 flex items-start gap-1.5 text-xs text-warning"
          :class="mode === 'setup' ? 'col-span-2' : ''"
          :data-testid="`http-suggestion-${suggestionId(item)}`"
        >
          <UIcon name="i-lucide-lock-open" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span class="font-medium">
              {{ t(mode === 'popup' ? 'approvals.httpShort' : 'approvals.httpTitle') }}
            </span>
            <template v-if="mode === 'setup'">{{ ' ' }}{{ t('approvals.httpWarning') }}</template>
          </span>
        </p>
        <div
          class="col-start-3 flex justify-end gap-2"
          :class="mode === 'popup' ? 'row-start-2' : 'row-start-1'"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="disabled"
            :label="t('approvals.dismissSuggestion')"
            :aria-label="`${t('approvals.dismissSuggestion')} ${displayDestination(item)}`"
            :data-testid="`dismiss-suggestion-${suggestionId(item)}`"
            @click="emit('dismiss', suggestionId(item))"
          />
          <UButton
            v-if="mode === 'setup'"
            size="sm"
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
            size="sm"
            trailing-icon="i-lucide-arrow-up-right"
            :disabled="disabled"
            :label="t('approvals.reviewSuggestion')"
            :aria-label="`${t('approvals.reviewSuggestion')} ${displayDestination(item)}`"
            :data-testid="`review-suggestion-${suggestionId(item)}`"
            @click="emit('review', suggestionId(item))"
          />
        </div>
      </li>
    </ul>
  </UCard>
</template>
