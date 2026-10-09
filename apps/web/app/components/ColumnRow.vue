<script setup lang="ts">
const {
  expanded = undefined,
  detailsId = undefined,
  kind = 'row',
  joined = false,
} = defineProps<{
  expanded?: boolean;
  detailsId?: string;
  /**
   * `row` is a top-level list row with a divider. `sub` and `label` sit inside an
   * expanded detail block (`ColumnDetail`): no divider, tighter height, and `label`
   * is the small section heading.
   */
  kind?: 'row' | 'sub' | 'label';
  /** The row's detail block follows it and draws the divider instead. */
  joined?: boolean;
}>();

const kindClass = {
  row: 'min-h-9 py-1 @max-[40rem]/list:py-1.5',
  sub: 'min-h-7 text-sm text-muted',
  label: 'min-h-6 pt-1.5 text-xs font-medium text-dimmed',
} as const;
</script>

<template>
  <div
    role="row"
    :aria-expanded="expanded"
    :aria-controls="detailsId"
    class="col-span-full grid min-w-0 grid-cols-subgrid items-center gap-y-1 @max-[40rem]/list:grid-cols-(--narrow-cols) @max-[40rem]/list:gap-x-2 @max-[40rem]/list:gap-y-0"
    :class="[kindClass[kind], kind === 'row' && !joined && 'border-b border-default']"
  >
    <slot />
  </div>
</template>
