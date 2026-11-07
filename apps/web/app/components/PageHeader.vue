<script setup lang="ts">
/**
 * The heading row every page opens with: the page's `h1` (and an optional one-line
 * description) on the left, the page's actions on the right.
 */
defineProps<{
  title: string;
  description?: string;
  headingTestid?: string;
}>();
</script>

<template>
  <header class="flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div class="grid min-w-0 gap-1">
      <h1
        class="m-0 truncate text-[1.375rem]/8 font-semibold tracking-tight text-highlighted"
        :data-testid="headingTestid"
      >
        {{ title }}
      </h1>
      <p v-if="description" class="m-0 text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
