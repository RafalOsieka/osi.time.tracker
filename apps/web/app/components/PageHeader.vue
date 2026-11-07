<script setup lang="ts">
/**
 * The heading row every page opens with: the page's `h1` on the left, the page's actions on the
 * right. Pages put it first in a `gap-6` column, so the header-to-content gap is 24px everywhere.
 */
defineProps<{
  title: string;
  headingTestid?: string;
}>();
</script>

<template>
  <header class="flex min-h-9 flex-wrap items-start justify-between gap-x-6 gap-y-3">
    <h1
      class="m-0 min-w-0 truncate text-[1.375rem]/8 font-semibold tracking-tight text-highlighted"
      :data-testid="headingTestid"
    >
      {{ title }}
    </h1>
    <div v-if="$slots.default" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
