<!--
  The expanded detail block under a `joined` ColumnRow: groups its `sub`/`label` rows
  on the list's columns on a faint inset surface and draws the single divider below them.
-->
<template>
  <div
    role="rowgroup"
    class="col-span-full grid grid-cols-subgrid border-b border-default pb-2 @max-[40rem]/list:block"
  >
    <div
      class="col-span-full mb-0.5 grid grid-cols-subgrid rounded-md bg-muted py-1 @max-[40rem]/list:block"
    >
      <slot />
    </div>
  </div>
</template>
