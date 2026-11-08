<script setup lang="ts">
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';

/**
 * The short type mark ("OP", "RM") shown before a Tracker's name in lists and selects, so every
 * system has an identity without leaving the palette. `null` is a local Project: the same chip in
 * neutral slate with a drive glyph. Decorative: the text beside it names it.
 */
const { systemType } = defineProps<{ systemType: TrackerSystemType | null }>();

const MARKS = {
  openproject: 'OP',
  redmine: 'RM',
} as const satisfies Record<TrackerSystemType, string>;
</script>

<template>
  <span
    class="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded px-1 text-[11px]/none font-semibold tracking-wide"
    :class="
      systemType
        ? 'bg-primary-100/80 text-primary dark:bg-primary/16'
        : 'bg-elevated text-muted ring-1 ring-default ring-inset dark:bg-accented/60'
    "
    aria-hidden="true"
    data-testid="tracker-type-mark"
  >
    <template v-if="systemType">{{ MARKS[systemType] }}</template>
    <UIcon v-else name="i-lucide-hard-drive" class="size-3.5" />
  </span>
</template>
