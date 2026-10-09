<script setup lang="ts" generic="Key extends string">
import type { ColumnDefinition } from './ColumnList.vue';

/** Where a cell sits below 40rem of list width: grid lines of the list's `narrow` tracks. */
export type NarrowPlacement = { col: readonly [start: number, end: number]; row: number };

const {
  columns,
  col,
  to = undefined,
  narrow,
  align = 'start',
} = defineProps<{
  columns: readonly ColumnDefinition<Key>[];
  col: NoInfer<Key>;
  to?: NoInfer<Key>;
  narrow: NarrowPlacement;
  align?: 'start' | 'end' | 'center';
}>();

// Placement goes through custom properties so the narrow layout can override it with
// classes; an inline `grid-column` would always win.
const placement = computed(() => {
  const start = columns.findIndex((column) => column.key === col) + 1;
  const end = to ? columns.findIndex((column) => column.key === to) + 2 : start + 1;
  return {
    '--col': `${start} / ${end}`,
    '--narrow-col': `${narrow.col[0]} / ${narrow.col[1]}`,
    '--narrow-row': String(narrow.row),
  };
});
</script>

<template>
  <div
    role="cell"
    class="col-(--col) min-w-0 @max-[40rem]/list:col-(--narrow-col) @max-[40rem]/list:row-(--narrow-row)"
    :class="align === 'end' && 'text-end'"
    :style="placement"
  >
    <slot />
  </div>
</template>
