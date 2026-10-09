<script setup lang="ts" generic="Key extends string">
export type ColumnDefinition<Key extends string = string> = {
  key: Key;
  track: `${number}rem` | { fr: number; min: `${number}rem` };
  header?: string;
  headerSrOnly?: boolean;
  align?: 'start' | 'end' | 'center';
};

const {
  columns,
  narrow,
  stickyHeader = true,
} = defineProps<{
  columns: readonly ColumnDefinition<Key>[];
  /**
   * `grid-template-columns` of every row below 40rem of list width, where rows leave the
   * shared columns and each cell takes its `narrow` placement (REQ-500).
   */
  narrow: string;
  stickyHeader?: boolean;
}>();

const template = computed(() =>
  columns
    .map((column) =>
      column.track instanceof Object
        ? `minmax(${column.track.min},${column.track.fr}fr)`
        : column.track,
    )
    .join(' '),
);
</script>

<template>
  <div class="@container/list min-w-0">
    <div
      role="table"
      class="grid gap-x-3 @max-[40rem]/list:block"
      :style="{ gridTemplateColumns: template, '--narrow-cols': narrow }"
    >
      <div
        role="row"
        class="col-span-full grid min-h-8 grid-cols-subgrid items-center border-b border-accented bg-default @max-[40rem]/list:sr-only"
        :class="stickyHeader && 'sticky top-0 z-10'"
      >
        <div
          v-for="(column, index) in columns"
          :key="column.key"
          role="columnheader"
          class="min-w-0 text-xs font-medium text-muted"
          :class="column.align === 'end' && 'text-end'"
          :style="{ gridColumn: index + 1 }"
        >
          <span :class="column.headerSrOnly && 'sr-only'">{{ column.header }}</span>
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>
