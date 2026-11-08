<script setup lang="ts">
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';

/**
 * The short type mark ("OP", "RM") before a tracker's address: a flat rounded-sm square, the one
 * shape of every list mark on the extension's pages, kept flatter than the action tiles so it
 * never reads as one. Decorative: the row names the type in text or in its accessible name.
 */
const { provider } = defineProps<{ provider: TrackerSystemType }>();

const MARKS = {
  openproject: 'OP',
  redmine: 'RM',
} as const satisfies Record<TrackerSystemType, string>;
</script>

<template>
  <span
    class="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary-100/50 text-[10px]/none font-semibold tracking-wide text-primary dark:bg-primary/10"
    aria-hidden="true"
  >
    {{ MARKS[provider] }}
  </span>
</template>
