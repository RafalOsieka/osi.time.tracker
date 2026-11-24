<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import type { DashboardPastYearDto } from '~~/shared/types/dashboard';
import { formatCalendarDate } from '~/utils/format-calendar-date';

/**
 * The time of each day over the past year as a calendar heatmap: a column per week, a row per
 * weekday from the first day of the week. Arrow keys move by a day up and down and by a week left
 * and right, Home and End to the first and the last day, and activating a day opens its week.
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
const LEVELS = LEVEL_HOURS.map((hours) => hours * 3600);

const legend = computed(() => [
  t('dashboard.heatmap.levelNone'),
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
  if (!pastYear) return undefined;
  const first = Temporal.PlainDate.from(pastYear.firstDay);
  return pastYear.daySeconds.map((seconds, index) => {
    const date = first.add({ days: index });
    return {
      date: date.toString(),
      dayOfMonth: date.day,
      label: formatCalendarDate(formats.value.long, date.toString()),
      seconds,
    };
  });
});

/** Empty cells before the first day, so that it lands in its weekday's row. */
const lead = computed(() => {
  if (!pastYear) return 0;
  const first = Temporal.PlainDate.from(pastYear.firstDay);
  return (first.dayOfWeek - firstDayOfWeek + DAYS_PER_WEEK) % DAYS_PER_WEEK;
});

const dayCount = computed(() => days.value?.length ?? 0);
const weekCount = computed(() => Math.ceil((lead.value + dayCount.value) / DAYS_PER_WEEK));

/** Each week's column, as the index of the day in it on the given row; none outside the year. */
function dayAt(week: number, row: number): number | null {
  const index = week * DAYS_PER_WEEK + row - lead.value;
  return index >= 0 && index < dayCount.value ? index : null;
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
      .map((index) => (index === null ? undefined : days.value?.[index]))
      .find((day) => day?.dayOfMonth === 1);
    return first ? formatCalendarDate(formats.value.month, first.date) : '';
  }),
);

function move(key: string, from: number): number | undefined {
  return new Map([
    ['ArrowUp', from - 1],
    ['ArrowDown', from + 1],
    ['ArrowLeft', from - DAYS_PER_WEEK],
    ['ArrowRight', from + DAYS_PER_WEEK],
    ['Home', 0],
    ['End', dayCount.value - 1],
  ]).get(key);
}

function open(index: number): void {
  const day = days.value?.[index];
  if (day) emit('open', day.date);
}
</script>

<template>
  <DashboardHeatmap
    id="dashboard-past-year"
    :heading="t('dashboard.pastYear.heading')"
    :hint="t('dashboard.pastYear.hint')"
    :caption="t('dashboard.pastYear.caption')"
    :legend="legend"
    :levels="LEVELS"
    :cells="days"
    :rows="rows"
    :column-labels="monthLabels"
    :initial-tab-stop="(pastYear?.daySeconds.length ?? 1) - 1"
    :move="move"
    activatable
    start-at-end
    @activate="open"
  />
</template>
