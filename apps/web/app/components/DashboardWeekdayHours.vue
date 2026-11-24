<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import {
  DASHBOARD_WEEKDAY_HOURS_WEEKS,
  type DashboardWeekdayHoursDto,
} from '~~/shared/types/dashboard';
import { formatCalendarDate } from '~/utils/format-calendar-date';

/**
 * When the user works: the average time per weekday and hour as a heatmap, a row per weekday from
 * the first day of the week and a column per hour. Arrow keys move by an hour left and right and
 * by a weekday up and down, Home and End to the first and the last hour.
 */
const { weekdayHours, firstDayOfWeek } = defineProps<{
  /** None until the first answer arrives. */
  weekdayHours: DashboardWeekdayHoursDto | undefined;
  /** ISO weekday of the first row. */
  firstDayOfWeek: number;
}>();

const { t, locale } = useI18n();

const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
/** Every this many hours a column is labelled. */
const LABEL_EVERY_HOURS = 3;
/** Upper bounds of the levels between none and the top one, in minutes. */
const LEVEL_MINUTES = [15, 30, 45] as const;
const TOP_LEVEL_MINUTES = 60;
const LEVELS = LEVEL_MINUTES.map((minutes) => minutes * 60);

const legend = computed(() => [
  t('dashboard.heatmap.levelNone'),
  ...[...LEVEL_MINUTES, TOP_LEVEL_MINUTES].map((minutes) =>
    t('dashboard.weekdayHours.levelUpTo', { minutes }),
  ),
]);

/** A Monday, whose date gives the weekday names and whose hours in UTC the hour names. */
const MONDAY = '2024-01-01';

const formats = computed(() => {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.value, { ...options, timeZone: 'UTC' });
  return {
    weekday: format({ weekday: 'short' }),
    hour: format({ hour: 'numeric' }),
    time: format({ hour: 'numeric', minute: '2-digit' }),
  };
});

/** ICU versions disagree on the kind of space before a day period, as in `formatCalendarDate`. */
function formatHour(format: Intl.DateTimeFormat, hour: number): string {
  return format.format(Date.UTC(2024, 0, 1, hour)).replace(/\p{Space_Separator}/gu, ' ');
}

/** The weekdays from the first day of the week, as ISO weekdays. */
const weekdays = computed(() =>
  Array.from(
    { length: DAYS_PER_WEEK },
    (_, row) => ((firstDayOfWeek - 1 + row) % DAYS_PER_WEEK) + 1,
  ),
);

function weekdayName(weekday: number): string {
  const day = Temporal.PlainDate.from(MONDAY).add({ days: weekday - 1 });
  return formatCalendarDate(formats.value.weekday, day.toString());
}

/** Row after row, each from midnight. */
const cells = computed(() => {
  if (!weekdayHours) return undefined;
  return weekdays.value.flatMap((weekday) =>
    Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
      label: t('dashboard.weekdayHours.cell', {
        weekday: weekdayName(weekday),
        from: formatHour(formats.value.time, hour),
        to: formatHour(formats.value.time, hour + 1),
      }),
      seconds: weekdayHours.hourSeconds[weekday - 1]?.[hour] ?? 0,
    })),
  );
});

const rows = computed(() =>
  weekdays.value.map((weekday, row) => ({
    label: weekdayName(weekday),
    cells: Array.from({ length: HOURS_PER_DAY }, (_, hour) => row * HOURS_PER_DAY + hour),
  })),
);

const hourLabels = computed(() =>
  Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
    hour % LABEL_EVERY_HOURS === 0 ? formatHour(formats.value.hour, hour) : '',
  ),
);

function move(key: string, from: number): number | undefined {
  return new Map([
    ['ArrowUp', from - HOURS_PER_DAY],
    ['ArrowDown', from + HOURS_PER_DAY],
    ['ArrowLeft', from - 1],
    ['ArrowRight', from + 1],
    ['Home', 0],
    ['End', DAYS_PER_WEEK * HOURS_PER_DAY - 1],
  ]).get(key);
}
</script>

<template>
  <DashboardHeatmap
    id="dashboard-weekday-hours"
    :heading="t('dashboard.weekdayHours.heading')"
    :hint="t('dashboard.weekdayHours.hint', { weeks: DASHBOARD_WEEKDAY_HOURS_WEEKS })"
    :caption="t('dashboard.weekdayHours.caption')"
    :legend="legend"
    :levels="LEVELS"
    :cells="cells"
    :rows="rows"
    :column-labels="hourLabels"
    :initial-tab-stop="0"
    :move="move"
  />
</template>
