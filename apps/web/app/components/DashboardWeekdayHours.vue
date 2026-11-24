<script setup lang="ts">
import {
  DASHBOARD_WEEKDAY_HOURS_WEEKS,
  type DashboardWeekdayHoursDto,
} from '~~/shared/types/dashboard';
import { calendarFormat, weekdaysFrom } from '~/utils/calendar-format';

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

const formats = computed(() => {
  const format = (options: Intl.DateTimeFormatOptions) => calendarFormat(locale.value, options);
  return {
    weekday: format({ weekday: 'short' }),
    hour: format({ hour: 'numeric' }),
    time: format({ hour: 'numeric', minute: '2-digit' }),
  };
});

const weekdays = computed(() => weekdaysFrom(firstDayOfWeek));

/** Row after row, each from midnight. */
const cells = computed(() => {
  if (!weekdayHours) return undefined;
  return weekdays.value.flatMap((weekday) =>
    Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
      label: t('dashboard.weekdayHours.cell', {
        weekday: formats.value.weekday.weekday(weekday),
        from: formats.value.time.hour(hour),
        to: formats.value.time.hour(hour + 1),
      }),
      seconds: weekdayHours.hourSeconds[weekday - 1]?.[hour] ?? 0,
    })),
  );
});

const rows = computed(() =>
  weekdays.value.map((weekday, row) => ({
    label: formats.value.weekday.weekday(weekday),
    cells: Array.from({ length: HOURS_PER_DAY }, (_, hour) => row * HOURS_PER_DAY + hour),
  })),
);

const hourLabels = computed(() =>
  Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
    hour % LABEL_EVERY_HOURS === 0 ? formats.value.hour.hour(hour) : '',
  ),
);
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
    :steps="{ right: 1, down: HOURS_PER_DAY }"
  />
</template>
