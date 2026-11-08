<script setup lang="ts">
import { computed } from 'vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import type { ActivityRecord } from '../activity/activity-store.js';
import { summarizeActivity } from '../activity/format-activity.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

/**
 * A tracker row's last activity (REQ-419) on one line: a success check, or the failure named in
 * the error colour, then the operation and how long ago it ran.
 */
const { record, now } = defineProps<{ record: ActivityRecord | undefined; now: number }>();

/** The dot between a failure and the operation, drawn in CSS like the pages' other separators. */
const SEPARATOR = "before:mx-1 before:content-['·']";

const { t, locale } = useExtensionI18n();
const summary = computed(() =>
  record ? summarizeActivity(record, now, locale.value, t.value) : null,
);
</script>

<template>
  <span class="flex min-w-0 items-start gap-1.5 text-xs text-muted">
    <span class="sr-only">{{ t('activity.label') }}:</span>
    <template v-if="summary">
      <UIcon
        :name="summary.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
        class="mt-px size-3.5 shrink-0"
        :class="summary.ok ? 'text-success' : 'text-error'"
        aria-hidden="true"
      />
      <span class="min-w-0">
        <span :class="summary.ok ? 'sr-only' : 'font-medium text-error'">
          {{ summary.outcome }}
        </span>
        <span :class="summary.ok ? undefined : SEPARATOR">
          {{ summary.detail }}
        </span>
      </span>
    </template>
    <span v-else>{{ t('activity.none') }}</span>
  </span>
</template>
