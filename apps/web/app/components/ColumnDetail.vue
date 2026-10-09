<!--
  The expanded detail block under a `joined` ColumnRow: groups its `sub`/`label` rows
  on the list's columns and draws the single divider below them.
-->
<template>
  <div
    role="rowgroup"
    class="col-span-full grid grid-cols-subgrid border-b border-default pb-1.5 @max-[40rem]/list:block"
  >
    <slot />
  </div>
</template>
