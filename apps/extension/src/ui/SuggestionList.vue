<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UAvatar from '@nuxt/ui/components/Avatar.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { canonicalizeDestination, isHttpCredentialRisk } from '../security/canonicalize.js';
import { suggestionId, type DestinationSuggestion } from '../suggestions/suggestions.js';

/**
 * Trackers that approved websites asked the user to approve. The setup page approves them in
 * place (the click runs the permission prompt); the popup only dismisses or hands over to setup.
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
const providerInitials = { openproject: 'OP', redmine: 'RM' } as const;

const trackerUrl = (item: DestinationSuggestion) => `${item.origin}${item.basePath}`;
const websiteHost = (origin: string) => new URL(origin).host;

function sendsCredentialsInClear(item: DestinationSuggestion): boolean {
  return isHttpCredentialRisk(canonicalizeDestination(trackerUrl(item)));
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
  <section
    v-if="suggestions.length"
    class="flex flex-col gap-2"
    aria-labelledby="suggestions-title"
    data-testid="suggestions"
  >
    <h2
      id="suggestions-title"
      :class="
        mode === 'setup'
          ? 'text-base font-semibold text-highlighted'
          : 'text-xs font-semibold text-muted'
      "
    >
      {{ t('approvals.suggestionsTitle') }}
    </h2>
    <ul class="divide-y divide-default rounded-md ring ring-default ring-inset">
      <li
        v-for="item in suggestions"
        :key="suggestionId(item)"
        class="flex flex-col gap-2 px-3 py-2"
        :class="{
          'bg-primary/5 ring-2 ring-primary ring-inset': suggestionId(item) === highlightId,
        }"
        :data-testid="`suggestion-${suggestionId(item)}`"
      >
        <div class="flex items-center gap-2.5">
          <UAvatar
            :text="providerInitials[item.provider]"
            size="sm"
            class="rounded-md"
            aria-hidden="true"
          />
          <span class="flex min-w-0 grow flex-col">
            <span class="text-[13px] break-all text-highlighted">{{ trackerUrl(item) }}</span>
            <span class="text-xs break-all text-muted">
              {{ t(`approvals.${item.provider}`) }}
              <span class="before:me-1 before:content-['·']">
                {{ t('approvals.suggestionFrom', { website: websiteHost(item.websiteOrigin) }) }}
              </span>
            </span>
          </span>
        </div>
        <UAlert
          v-if="mode === 'setup' && sendsCredentialsInClear(item)"
          role="status"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('approvals.httpWarning')"
        />
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="disabled"
            :label="t('approvals.dismissSuggestion')"
            :aria-label="`${t('approvals.dismissSuggestion')} ${trackerUrl(item)}`"
            :data-testid="`dismiss-suggestion-${suggestionId(item)}`"
            @click="emit('dismiss', suggestionId(item))"
          />
          <UButton
            v-if="mode === 'setup'"
            size="xs"
            icon="i-lucide-check"
            :disabled="disabled"
            :label="t('approvals.approveSuggestion')"
            :aria-label="`${t('approvals.approveSuggestion')} ${trackerUrl(item)}`"
            :data-testid="`approve-suggestion-${suggestionId(item)}`"
            @click="emit('approve', suggestionId(item))"
          />
          <UButton
            v-else
            size="xs"
            icon="i-lucide-settings-2"
            :disabled="disabled"
            :label="t('approvals.reviewSuggestion')"
            :aria-label="`${t('approvals.reviewSuggestion')} ${trackerUrl(item)}`"
            :data-testid="`review-suggestion-${suggestionId(item)}`"
            @click="emit('review', suggestionId(item))"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
