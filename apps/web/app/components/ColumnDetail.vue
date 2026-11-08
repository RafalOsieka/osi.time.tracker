<!--
  The expanded detail block under a `joined` ColumnRow: groups its `sub`/`label` rows
  on the list's columns on an inset band (the muted layer inside the list's white card, lighter
  than the page canvas so it never reads as a hole; one layer up in dark) and draws the single
  divider below them. Between rows the band spans exactly
  the width of the row dividers and ends on its own divider: no bleed past the rows, no sliver
  below. As the list's last item it has no divider (the card's edge closes the list), so it
  stops 16px above the card's bottom edge, the same inset the card keeps at its sides, with
  rounded bottom corners instead of running into the card's border.
-->
<template>
  <div
    role="rowgroup"
    class="group/detail col-span-full grid grid-cols-subgrid border-b border-default last:pb-4 @max-[40rem]/list:block"
  >
    <div
      class="col-span-full grid grid-cols-subgrid bg-muted py-1 group-last/detail:rounded-b-md dark:bg-elevated @max-[40rem]/list:block"
    >
      <slot />
    </div>
  </div>
</template>
