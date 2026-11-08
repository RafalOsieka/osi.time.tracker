<script setup lang="ts">
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';

/**
 * The short type mark ("OP", "RM") before a tracker's address, the same chip the web app's
 * Trackers list shows. Decorative: the row names the type in text or in its accessible name.
 */
const { provider } = defineProps<{ provider: TrackerSystemType }>();

const MARKS = {
  openproject: 'OP',
  redmine: 'RM',
} as const satisfies Record<TrackerSystemType, string>;
</script>

<template>
  <span
    class="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded bg-primary-100/80 px-1 text-[10px]/none font-semibold tracking-wide text-primary dark:bg-primary/16"
    aria-hidden="true"
  >
    {{ MARKS[provider] }}
  </span>
</template>
