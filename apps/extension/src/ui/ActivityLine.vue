<script setup lang="ts">
import { computed } from 'vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import type { ActivityRecord } from '../activity/activity-store.js';
import { summarizeActivity } from '../activity/format-activity.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

/**
 * A tracker row's last activity (REQ-419): a mark, then what ran and how long ago. A failure says
 * so in words ("Wyszukiwanie zgłoszeń nie powiodło się", worded per operation for Polish
 * agreement) under its own glyph; the "!" circle stays for live problems. A failure the row's
 * current badge does not explain gets an amber mark and its reason on a second line; a denied
 * attempt the "No access" badge already explains stays one quiet line under a muted mark.
 */
const {
  record,
  now,
  accessMissing = false,
  stacked = false,
} = defineProps<{
  record: ActivityRecord | undefined;
  now: number;
  /** The row already shows a current "No access" badge, so a denied attempt is told quietly. */
  accessMissing?: boolean;
  /** Narrow rows (the popup) put a failure's time on its own line instead of after a dot. */
  stacked?: boolean;
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
      <!-- A past failure has its own glyph; the "!" circle is kept for problems that are live. -->
      <UIcon
        :name="summary.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
        class="mt-[0.2em] size-[1.1em] shrink-0"
        :class="summary.ok ? 'text-success' : quiet ? 'text-dimmed' : 'text-warning'"
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-col">
        <span>
          <span v-if="summary.ok" class="sr-only">{{ summary.outcome }}</span>
          {{ summary.ok ? summary.operation : summary.failure }}
          <span v-if="summary.ok || !stacked" class="whitespace-nowrap" :class="SEPARATOR">
            {{ summary.when }}
          </span>
        </span>
        <span v-if="!summary.ok && stacked">{{ summary.when }}</span>
        <span v-if="!summary.ok && !quiet" data-testid="activity-failure">
          {{ summary.outcome }}
        </span>
      </span>
    </template>
    <span v-else>{{ t('activity.none') }}</span>
  </span>
</template>
