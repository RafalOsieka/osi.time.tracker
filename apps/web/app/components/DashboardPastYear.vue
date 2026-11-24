<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import type { DashboardPastYearDto } from '~~/shared/types/dashboard';
import { formatCalendarDate } from '~/utils/format-calendar-date';
import { formatReportDuration } from '~/utils/format-report-duration';

/**
 * The time of each day over the past year as a calendar heatmap: a column per week, a row per
 * weekday from the first day of the week. One tab stop: arrow keys move by a day up and down and
 * by a week left and right, Home and End to the first and the last day, and Enter, Space or a
 * click opens the day's week.
 */
const { pastYear, firstDayOfWeek } = defineProps<{
  /** None until the first answer arrives. */
  pastYear: DashboardPastYearDto | undefined;
  /** ISO weekday that opens a week and the heatmap's first row. */
  firstDayOfWeek: number;
}>();

const emit = defineEmits<{ open: [day: string] }>();

const { t, locale } = useI18n();

const DAYS_PER_WEEK = 7;
/** Upper bounds of the levels between none and the top one, in hours. */
const LEVEL_HOURS = [2, 4, 8] as const;
// Full class names, so Tailwind finds them.
const LEVEL_COLORS = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

function levelOf(seconds: number): number {
  if (seconds === 0) return 0;
  const level = LEVEL_HOURS.findIndex((hours) => seconds <= hours * 3600);
  return level === -1 ? LEVEL_HOURS.length + 1 : level + 1;
}

const legend = computed(() => [
  t('dashboard.pastYear.levelNone'),
  ...LEVEL_HOURS.map((hours) => t('dashboard.pastYear.levelUpTo', { hours })),
  t('dashboard.pastYear.levelOver', { hours: LEVEL_HOURS.at(-1) }),
]);

/** Days are calendar dates, so they format in UTC to stay on the same day. */
const formats = computed(() => {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.value, { ...options, timeZone: 'UTC' });
  return {
    weekday: format({ weekday: 'short' }),
    month: format({ month: 'short' }),
    long: format({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  };
});

const days = computed(() => {
  if (!pastYear) return [];
  const first = Temporal.PlainDate.from(pastYear.firstDay);
  return pastYear.daySeconds.map((seconds, index) => {
    const date = first.add({ days: index });
    const long = formatCalendarDate(formats.value.long, date.toString());
    const time = formatReportDuration(seconds);
    return {
      date: date.toString(),
      dayOfMonth: date.day,
      seconds,
      color: LEVEL_COLORS[levelOf(seconds)],
      long,
      time,
      name: t('dashboard.pastYear.day', { day: long, time }),
    };
  });
});

/** Empty cells before the first day, so that it lands in its weekday's row. */
const lead = computed(() => {
  if (!pastYear) return 0;
  const first = Temporal.PlainDate.from(pastYear.firstDay);
  return (first.dayOfWeek - firstDayOfWeek + DAYS_PER_WEEK) % DAYS_PER_WEEK;
});

const weekCount = computed(() => Math.ceil((lead.value + days.value.length) / DAYS_PER_WEEK));

/** Each week's column, as the index of the day in it on the given row; none outside the year. */
function dayAt(week: number, row: number): number | null {
  const index = week * DAYS_PER_WEEK + row - lead.value;
  return index >= 0 && index < days.value.length ? index : null;
}

const rows = computed(() =>
  Array.from({ length: DAYS_PER_WEEK }, (_, row) => {
    // A Monday of 2024-01-01 onwards gives the weekday of the row.
    const weekday = Temporal.PlainDate.from('2024-01-01').add({ days: firstDayOfWeek - 1 + row });
    return {
      label: formatCalendarDate(formats.value.weekday, weekday.toString()),
      cells: Array.from({ length: weekCount.value }, (_, week) => dayAt(week, row)),
    };
  }),
);

/** The month whose first day falls in a week names its column. */
const monthLabels = computed(() =>
  Array.from({ length: weekCount.value }, (_, week) => {
    const first = Array.from({ length: DAYS_PER_WEEK }, (_, row) => dayAt(week, row))
      .map((index) => (index === null ? undefined : days.value[index]))
      .find((day) => day?.dayOfMonth === 1);
    return first ? formatCalendarDate(formats.value.month, first.date) : '';
  }),
);

/** Widths in rem of the weekday labels, of the smallest cell and of the gap (`gap-0.75`). */
const LABEL_REM = 2.5;
const CELL_REM = 0.75;
const GAP_REM = 0.1875;

/** The weekday labels, then one track per week that never gets narrower than a small cell. */
const columns = computed(() => ({
  gridTemplateColumns: `${LABEL_REM}rem repeat(${weekCount.value}, minmax(${CELL_REM}rem, 1fr))`,
}));
/** The grid never gets narrower than its smallest cells, so a narrow screen scrolls it. */
const minWidth = computed(() => `${LABEL_REM + weekCount.value * (CELL_REM + GAP_REM)}rem`);

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
  // Today, the latest day, holds the tab stop at first.
  initialTabStop: (pastYear?.daySeconds.length ?? 1) - 1,
});
const shown = computed(() =>
  shownIndex.value === null ? undefined : days.value[shownIndex.value],
);

// A narrow screen starts at the latest weeks.
const scrollElement = useTemplateRef('scroll');
onMounted(() => {
  if (scrollElement.value) scrollElement.value.scrollLeft = scrollElement.value.scrollWidth;
});

function open(index: number | null): void {
  const day = index === null ? undefined : days.value[index];
  if (day) emit('open', day.date);
}

function onKeydown(event: KeyboardEvent): void {
  const from = tabStop.value;
  const last = days.value.length - 1;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    open(from);
    return;
  }
  const targets = new Map([
    ['ArrowUp', from - 1],
    ['ArrowDown', from + 1],
    ['ArrowLeft', from - DAYS_PER_WEEK],
    ['ArrowRight', from + DAYS_PER_WEEK],
    ['Home', 0],
    ['End', last],
  ]);
  const target = targets.get(event.key);
  if (target === undefined) return;
  event.preventDefault();
  if (target >= 0 && target <= last) focusCell(target);
}
</script>

<template>
  <section
    class="grid gap-3 rounded-xl bg-default p-4 ring ring-default dark:bg-muted"
    aria-labelledby="dashboard-past-year-heading"
    data-testid="dashboard-past-year"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <div class="grid gap-0.5">
        <h2 id="dashboard-past-year-heading" class="m-0 text-base font-semibold text-highlighted">
          {{ t('dashboard.pastYear.heading') }}
        </h2>
        <p id="dashboard-past-year-hint" class="m-0 text-sm text-muted">
          {{ t('dashboard.pastYear.hint') }}
        </p>
      </div>
      <ul
        class="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-xs text-muted"
        :aria-label="t('dashboard.pastYear.legend')"
        data-testid="dashboard-past-year-legend"
      >
        <li v-for="(level, index) in legend" :key="level" class="flex items-center gap-1.5">
          <span class="size-3 rounded-xs" :class="LEVEL_COLORS[index]" aria-hidden="true" />
          {{ level }}
        </li>
      </ul>
    </div>

    <USkeleton v-if="!pastYear" class="h-36 rounded-lg" aria-hidden="true" />
    <!-- A narrow screen scrolls the weeks here, never the page, under fixed weekday labels. -->
    <div v-else ref="scroll" class="overflow-x-auto pb-1" data-testid="dashboard-past-year-scroll">
      <div class="grid gap-0.75" :style="{ minWidth }">
        <div
          class="grid h-4 gap-0.75 text-xs text-muted"
          :style="columns"
          aria-hidden="true"
          data-testid="dashboard-past-year-months"
        >
          <span class="sticky start-0 bg-default dark:bg-muted" />
          <span v-for="(label, week) in monthLabels" :key="week" class="whitespace-nowrap">
            {{ label }}
          </span>
        </div>
        <!-- Each cell is named by its date and time. The cells hold the roving tab stop, and the
             grid listens for all of them. -->
        <div
          ref="grid"
          role="grid"
          :aria-label="t('dashboard.pastYear.caption')"
          aria-describedby="dashboard-past-year-hint"
          tabindex="-1"
          class="grid gap-0.75 outline-none"
          @keydown="onKeydown"
          @click="open(cellOf($event))"
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
              data-testid="dashboard-past-year-weekday"
            >
              {{ row.label }}
            </span>
            <template v-for="(index, week) in row.cells" :key="week">
              <div v-if="index === null" aria-hidden="true" />
              <div
                v-else
                :ref="(element) => keepCell(element, index)"
                role="gridcell"
                :aria-label="days[index]?.name"
                :tabindex="index === tabStop ? 0 : -1"
                class="aspect-square cursor-pointer rounded-xs outline-offset-1 focus-visible:outline-2 focus-visible:outline-inverted"
                :class="[
                  days[index]?.color,
                  { 'outline-2 outline-inverted': index === shownIndex },
                ]"
                data-testid="dashboard-past-year-day"
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
        <!-- Fills the whole tooltip and touches the day, so the pointer can move onto it. -->
        <p
          v-if="shown"
          ref="tooltip"
          class="m-0 flex justify-between gap-4 px-2.5 py-2"
          data-testid="dashboard-past-year-tooltip"
        >
          <span>{{ shown.long }}</span>
          <span class="font-mono tabular-nums">{{ shown.time }}</span>
        </p>
      </template>
    </UTooltip>
  </section>
</template>
