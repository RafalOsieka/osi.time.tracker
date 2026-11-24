<script setup lang="ts">
import { formatReportDuration } from '~/utils/format-report-duration';

/**
 * A Dashboard heatmap: a card with a heading, a hint and a legend of five fixed levels, over a
 * grid of cells in labelled rows and columns. The grid is one tab stop. The arrow keys, Home and
 * End move by what `move` says, and Enter, Space or a click activate a cell when `activatable`.
 * Hovering or focusing a cell shows its label and time.
 */
const {
  id,
  heading,
  hint,
  caption,
  legend,
  levels,
  cells,
  rows,
  columnLabels,
  initialTabStop,
  move,
  activatable = false,
  startAtEnd = false,
} = defineProps<{
  /** Prefix of the element ids and test ids. */
  id: string;
  heading: string;
  /** Describes the grid too. */
  hint: string;
  /** The grid's accessible name. */
  caption: string;
  /** Names of the levels from none to the top one. */
  legend: string[];
  /** Upper bounds in seconds of the levels between none and the top one. */
  levels: readonly number[];
  /** None until the first answer arrives. */
  cells: { label: string; seconds: number }[] | undefined;
  /** Each row's cells as indexes into `cells`; none where a row has no cell in that column. */
  rows: { label: string; cells: (number | null)[] }[];
  /** One per column, empty where a column has none. */
  columnLabels: string[];
  initialTabStop: number;
  /** The cell a key moves to from a cell; none for a key that does not move. */
  move: (key: string, from: number) => number | undefined;
  activatable?: boolean;
  /** A grid wider than its box starts scrolled to its last columns. */
  startAtEnd?: boolean;
}>();

const emit = defineEmits<{ activate: [index: number] }>();

const { t } = useI18n();

// Full class names, so Tailwind finds them.
const LEVEL_COLORS = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

/** The level of the time as shown, in whole minutes, so that a shade never contradicts it. */
function levelOf(seconds: number): number {
  const shown = Math.floor(seconds / 60) * 60;
  if (shown <= 0) return 0;
  const level = levels.findIndex((bound) => shown <= bound);
  return level === -1 ? levels.length + 1 : level + 1;
}

const shownCells = computed(() =>
  (cells ?? []).map(({ label, seconds }) => {
    const time = formatReportDuration(seconds);
    return {
      label,
      time,
      color: LEVEL_COLORS[levelOf(seconds)],
      name: t('dashboard.heatmap.cell', { label, time }),
    };
  }),
);

/** Widths in rem of the row labels, of the smallest cell and of the gap (`gap-0.75`). */
const LABEL_REM = 2.5;
const CELL_REM = 0.75;
const GAP_REM = 0.1875;

/** The row labels, then one track per column that never gets narrower than a small cell. */
const columns = computed(() => ({
  gridTemplateColumns: `${LABEL_REM}rem repeat(${columnLabels.length}, minmax(${CELL_REM}rem, 1fr))`,
}));
/** The grid never gets narrower than its smallest cells, so a narrow screen scrolls it. */
const minWidth = computed(() => `${LABEL_REM + columnLabels.length * (CELL_REM + GAP_REM)}rem`);

const {
  tabStop,
  shownIndex,
  shownElement,
  keepCell,
  cellOf,
  onMouseover,
  onFocusin,
  onFocusout,
  focusCell,
} = useChartCells({
  grid: useTemplateRef('grid'),
  tooltip: useTemplateRef('tooltip'),
  initialTabStop,
});
const shown = computed(() =>
  shownIndex.value === null ? undefined : shownCells.value[shownIndex.value],
);

function activate(index: number | null): void {
  if (activatable && index !== null) emit('activate', index);
}

function onKeydown(event: KeyboardEvent): void {
  const from = tabStop.value;
  if (event.key === 'Enter' || event.key === ' ') {
    if (!activatable) return;
    event.preventDefault();
    activate(from);
    return;
  }
  const target = move(event.key, from);
  if (target === undefined) return;
  event.preventDefault();
  if (target >= 0 && target < shownCells.value.length) focusCell(target);
}
</script>

<template>
  <section
    class="grid content-start gap-3 rounded-xl bg-default p-4 ring ring-default dark:bg-muted"
    :aria-labelledby="`${id}-heading`"
    :data-testid="id"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div class="grid gap-0.5">
        <h2 :id="`${id}-heading`" class="m-0 text-base font-semibold text-highlighted">
          {{ heading }}
        </h2>
        <p :id="`${id}-hint`" class="m-0 text-sm text-muted">{{ hint }}</p>
      </div>
      <ul
        class="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-xs text-muted"
        :aria-label="t('dashboard.heatmap.legend')"
        :data-testid="`${id}-legend`"
      >
        <li v-for="(level, index) in legend" :key="level" class="flex items-center gap-1.5">
          <span class="size-3 rounded-xs" :class="LEVEL_COLORS[index]" aria-hidden="true" />
          {{ level }}
        </li>
      </ul>
    </div>

    <USkeleton v-if="!cells" class="h-36 rounded-lg" aria-hidden="true" />
    <!-- A narrow screen scrolls the columns here, never the page, under fixed row labels. A
         reversed row starts scrolled to its end, already in the server's HTML. -->
    <div
      v-else
      class="overflow-x-auto pb-1"
      :class="{ 'flex flex-row-reverse': startAtEnd }"
      :data-testid="`${id}-scroll`"
    >
      <div class="grid grow gap-0.75" :style="{ minWidth }">
        <div
          class="grid h-4 gap-0.75 text-xs text-muted"
          :style="columns"
          aria-hidden="true"
          :data-testid="`${id}-columns`"
        >
          <span class="sticky start-0 bg-default dark:bg-muted" />
          <span v-for="(label, column) in columnLabels" :key="column" class="whitespace-nowrap">
            {{ label }}
          </span>
        </div>
        <!-- Each cell is named by its label and time. The cells hold the roving tab stop, and the
             grid listens for all of them. -->
        <div
          ref="grid"
          role="grid"
          :aria-label="caption"
          :aria-describedby="`${id}-hint`"
          tabindex="-1"
          class="grid gap-0.75 outline-none"
          @keydown="onKeydown"
          @click="activate(cellOf($event))"
          @mouseover="onMouseover"
          @focusin="onFocusin"
          @focusout="onFocusout"
        >
          <div
            v-for="row in rows"
            :key="row.label"
            role="row"
            class="grid gap-0.75"
            :style="columns"
          >
            <span
              class="sticky start-0 flex items-center bg-default text-xs leading-none text-muted dark:bg-muted"
              aria-hidden="true"
              :data-testid="`${id}-row`"
            >
              {{ row.label }}
            </span>
            <template v-for="(index, column) in row.cells" :key="column">
              <div v-if="index === null" aria-hidden="true" />
              <div
                v-else
                :ref="(element) => keepCell(element, index)"
                role="gridcell"
                :aria-label="shownCells[index]?.name"
                :tabindex="index === tabStop ? 0 : -1"
                class="aspect-square rounded-xs outline-offset-1 focus-visible:outline-2 focus-visible:outline-inverted"
                :class="[
                  shownCells[index]?.color,
                  {
                    'cursor-pointer': activatable,
                    'outline-2 outline-inverted': index === shownIndex,
                  },
                ]"
                :data-testid="`${id}-cell`"
              />
            </template>
          </div>
        </div>
      </div>
    </div>
    <UTooltip
      :open="!!shown"
      :reference="shownElement"
      :content="{ side: 'top', sideOffset: 0 }"
      :ui="{ content: 'h-auto p-0' }"
    >
      <template #content>
        <!-- Fills the whole tooltip and touches the cell, so the pointer can move onto it. -->
        <p
          v-if="shown"
          ref="tooltip"
          class="m-0 flex justify-between gap-4 px-2.5 py-2"
          :data-testid="`${id}-tooltip`"
        >
          <span>{{ shown.label }}</span>
          <span class="font-mono tabular-nums">{{ shown.time }}</span>
        </p>
      </template>
    </UTooltip>
  </section>
</template>
