<script setup lang="ts">
/**
 * One summary figure: a label, the value (default slot, a duration in the mono face) and an
 * optional one-line caption. Remote sync and the monthly timesheet share it, laid out in an
 * equal-width grid.
 */
defineProps<{ label: string }>();
</script>

<template>
  <div
    class="grid min-w-0 content-start gap-1 rounded-lg border border-default bg-default px-5 py-4 dark:bg-muted"
  >
    <p class="m-0 text-[0.8125rem]/5 font-medium text-muted">{{ label }}</p>
    <div
      class="flex min-h-8 items-center gap-2 font-mono text-2xl/8 font-medium tabular-nums text-highlighted"
    >
      <slot />
    </div>
    <div v-if="$slots.caption" class="min-h-5 text-[0.8125rem]/5 text-muted">
      <slot name="caption" />
    </div>
  </div>
</template>
