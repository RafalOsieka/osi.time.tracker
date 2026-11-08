<!--
  The expanded detail block under a `joined` ColumnRow: groups its `sub`/`label` rows
  on the list's columns on an inset panel (the canvas tone inside the list's white card, one
  layer up in dark) and draws the single divider below them. The panel reaches 8px past the
  columns on both sides, so controls in the last column never touch its edge.
-->
<template>
  <div
    role="rowgroup"
    class="col-span-full grid grid-cols-subgrid border-b border-default pb-2 @max-[40rem]/list:block"
  >
    <div
      class="col-span-full -mx-2 mb-0.5 grid grid-cols-subgrid rounded-md bg-(--app-canvas) px-2 py-1 dark:bg-elevated @max-[40rem]/list:block"
    >
      <slot />
    </div>
  </div>
</template>
