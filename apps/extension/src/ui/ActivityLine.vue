<script setup lang="ts">
import { computed } from 'vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import type { ActivityRecord } from '../activity/activity-store.js';
import { summarizeActivity } from '../activity/format-activity.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

/**
 * A tracker row's last activity (REQ-419). A success is one line: a check, the operation and how
 * long ago it ran. A failure names itself beside a red mark on the first line, with the
 * operation and its time on the second.
 */
const { record, now } = defineProps<{ record: ActivityRecord | undefined; now: number }>();

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
        :class="summary.ok ? 'text-success' : 'text-error'"
        aria-hidden="true"
      />
      <span v-if="summary.ok" class="min-w-0">
        <span class="sr-only">{{ summary.outcome }}</span>
        {{ summary.operation }}
        <span :class="SEPARATOR">{{ summary.when }}</span>
      </span>
      <span v-else class="flex min-w-0 flex-col">
        <span class="font-medium text-highlighted">{{ summary.outcome }}</span>
        <span>
          {{ summary.operation }}
          <span :class="SEPARATOR">{{ summary.when }}</span>
        </span>
      </span>
    </template>
    <span v-else>{{ t('activity.none') }}</span>
  </span>
</template>
