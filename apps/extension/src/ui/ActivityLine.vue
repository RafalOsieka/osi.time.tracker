<script setup lang="ts">
import { computed } from 'vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import type { ActivityRecord } from '../activity/activity-store.js';
import { summarizeActivity } from '../activity/format-activity.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

/**
 * A tracker row's last activity (REQ-419): a mark, the operation and how long ago it ran. A
 * failure is a recoverable problem, so its mark is amber, and a second line says what went
 * wrong; the row's current state (such as a "No access" badge) is shown apart from this history,
 * and a denied attempt it already explains is told quietly (a muted mark, "Failed" alone).
 */
const {
  record,
  now,
  accessMissing = false,
} = defineProps<{
  record: ActivityRecord | undefined;
  now: number;
  /** The row already shows a current "No access" badge, so a denied attempt is told quietly. */
  accessMissing?: boolean;
}>();

/** A denied attempt on a row that has lost access repeats nothing the badge already says. */
const quiet = computed(() => accessMissing && record?.outcome === 'permission');

/** The dot between two parts of a line, drawn in CSS like the pages' other separators. */
const SEPARATOR = "before:me-1 before:content-['·']";

const { t, locale } = useExtensionI18n();
const summary = computed(() =>
  record ? summarizeActivity(record, now, locale.value, t.value) : null,
);
</script>

<template>
  <span class="flex min-w-0 items-start gap-1.5 text-muted">
    <span class="sr-only">{{ t('activity.label') }}:</span>
    <template v-if="summary">
      <UIcon
        :name="summary.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
        class="mt-[0.2em] size-[1.1em] shrink-0"
        :class="summary.ok ? 'text-success' : quiet ? 'text-dimmed' : 'text-warning'"
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-col">
        <span>
          <span v-if="summary.ok" class="sr-only">{{ summary.outcome }}</span>
          {{ summary.operation }}
          <span :class="SEPARATOR">{{ summary.when }}</span>
        </span>
        <span v-if="!summary.ok" data-testid="activity-failure">
          {{
            quiet
              ? t('activity.failed')
              : t('activity.failedWith', { outcome: summary.outcome.toLocaleLowerCase(locale) })
          }}
        </span>
      </span>
    </template>
    <span v-else>{{ t('activity.none') }}</span>
  </span>
</template>
