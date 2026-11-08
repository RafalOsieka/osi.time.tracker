<script setup lang="ts">
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';

/**
 * The short type mark ("OP", "RM") shown before a Tracker's name or system in lists, so every
 * system has an identity without leaving the palette. Decorative: the text beside it names it.
 */
const { systemType } = defineProps<{ systemType: TrackerSystemType }>();

const MARKS = {
  openproject: 'OP',
  redmine: 'RM',
} as const satisfies Record<TrackerSystemType, string>;
</script>

<template>
  <span
    class="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded bg-primary-100/80 px-1 text-[10px]/none font-semibold tracking-wide text-primary dark:bg-primary/16"
    aria-hidden="true"
    data-testid="tracker-type-mark"
  >
    {{ MARKS[systemType] }}
  </span>
</template>
