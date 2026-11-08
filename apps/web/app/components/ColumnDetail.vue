<!--
  The expanded detail block under a `joined` ColumnRow: groups its `sub`/`label` rows
  on the list's columns on an inset band (the canvas tone inside the list's white card, one
  layer up in dark) and draws the single divider below them. The band spans exactly the width
  of the row dividers and ends on its own divider: no bleed past the rows, no sliver below.
-->
<template>
  <div
    role="rowgroup"
    class="col-span-full grid grid-cols-subgrid border-b border-default @max-[40rem]/list:block"
  >
    <div
      class="col-span-full grid grid-cols-subgrid bg-(--app-canvas) py-1 dark:bg-elevated @max-[40rem]/list:block"
    >
      <slot />
    </div>
  </div>
</template>
