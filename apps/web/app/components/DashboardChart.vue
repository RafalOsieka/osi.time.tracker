<script setup lang="ts">
import type { DashboardGrouping, DashboardPeriodKind } from '~~/shared/types/dashboard';
import { formatCalendarDate } from '~/utils/format-calendar-date';
import { formatReportDuration } from '~/utils/format-report-duration';

/**
 * Stacked columns, one per bucket of the period, drawn from plain markup so the server sends the
 * final chart. One tab stop: arrow keys, Home and End move between columns, and a column's
 * breakdown shows in a tooltip on hover and on focus and in its accessible name.
 */
const { series, buckets, kind, grouping } = defineProps<{
  /** The stacked parts, bottom first, each with one value per bucket. */
  series: readonly {
    key: string;
    name: string;
    color: `bg-chart-${string}`;
    bucketSeconds: readonly number[];
  }[];
  buckets: readonly string[];
  kind: DashboardPeriodKind;
  /** What the series stand for, which names the chart. */
  grouping: DashboardGrouping;
}>();

const { t, locale } = useI18n();

const chartName = computed(() =>
  t(`dashboard.chartCaption.${grouping}`, {
    bucket: t(`dashboard.chartBucket.${kind === 'year' ? 'month' : 'day'}`),
  }),
);

/** Hours between grid lines, the smallest that needs no more than `MAX_TICKS` of them. */
const HOUR_STEPS = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500] as const;
const MAX_TICKS = 4;

/** Buckets are calendar dates, so they format in UTC to stay on the same day. */
const formats = computed(() => {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.value, { ...options, timeZone: 'UTC' });
  return kind === 'year'
    ? { short: format({ month: 'short' }), long: format({ month: 'long', year: 'numeric' }) }
    : {
        short: format({ weekday: 'short' }),
        long: format({ weekday: 'short', day: 'numeric', month: 'short' }),
      };
});

const segmentList = computed(
  () => new Intl.ListFormat(locale.value, { type: 'unit', style: 'short' }),
);

/** Under a month's columns only the first day and every fifth fit. */
function shortLabel(bucket: string): string {
  if (kind !== 'month') return formatCalendarDate(formats.value.short, bucket);
  const day = Number(bucket.slice(8));
  return day === 1 || day % 5 === 0 ? String(day) : '';
}

const columns = computed(() =>
  buckets.map((bucket, index) => {
    const segments = series
      .map(({ key, name, color, bucketSeconds }) => ({
        key,
        name,
        color,
        seconds: bucketSeconds[index] ?? 0,
      }))
      .filter((segment) => segment.seconds > 0);
    const totalSeconds = segments.reduce((sum, segment) => sum + segment.seconds, 0);
    const long = formatCalendarDate(formats.value.long, bucket);
    const total = formatReportDuration(totalSeconds);
    const split = segmentList.value.format(
      segments.map(({ name, seconds }) =>
        t('dashboard.chartSegment', { name, time: formatReportDuration(seconds) }),
      ),
    );
    return {
      bucket,
      segments,
      totalSeconds,
      long,
      short: shortLabel(bucket),
      description:
        segments.length === 0
          ? t('dashboard.chartColumn', { bucket: long, total })
          : t('dashboard.chartColumnSplit', { bucket: long, total, split }),
    };
  }),
);

const scale = computed(() => {
  const peakHours = Math.max(0, ...columns.value.map((column) => column.totalSeconds)) / 3600;
  const step =
    HOUR_STEPS.find((hours) => Math.ceil(peakHours / hours) <= MAX_TICKS) ??
    Math.ceil(peakHours / MAX_TICKS);
  const count = Math.max(1, Math.ceil(peakHours / step));
  return {
    topSeconds: count * step * 3600,
    ticks: Array.from({ length: count + 1 }, (_, index) => ({
      label: t('dashboard.chartHours', { hours: index * step }),
      percent: (index / count) * 100,
    })),
  };
});

const {
  tabStop,
  shownIndex,
  shownElement,
  keepCell,
  onMouseover,
  onFocusin,
  onFocusout,
  focusCell,
} = useChartCells({ grid: useTemplateRef('grid'), tooltip: useTemplateRef('tooltip') });
const shown = computed(() =>
  shownIndex.value === null ? undefined : columns.value[shownIndex.value],
);

function onKeydown(event: KeyboardEvent): void {
  const from = tabStop.value;
  const last = buckets.length - 1;
  const targets = new Map([
    ['ArrowLeft', Math.max(0, from - 1)],
    ['ArrowRight', Math.min(last, from + 1)],
    ['Home', 0],
    ['End', last],
  ]);
  const target = targets.get(event.key);
  if (target === undefined) return;
  event.preventDefault();
  focusCell(target);
}
</script>

<template>
  <div class="flex gap-2 pt-2" data-testid="dashboard-chart">
    <div class="relative h-56 w-10 shrink-0 font-mono text-xs text-muted" aria-hidden="true">
      <span
        v-for="tick in scale.ticks"
        :key="tick.label"
        class="absolute end-0 translate-y-1/2 whitespace-nowrap"
        :style="{ bottom: `${tick.percent}%` }"
        data-testid="dashboard-chart-tick"
      >
        {{ tick.label }}
      </span>
    </div>
    <!-- A narrow screen scrolls the columns here, never the page. -->
    <div class="min-w-0 flex-1 overflow-x-auto" data-testid="dashboard-chart-scroll">
      <div class="relative" :style="{ minWidth: `${buckets.length * 0.875}rem` }">
        <div class="absolute inset-x-0 top-0 h-56" aria-hidden="true">
          <div
            v-for="tick in scale.ticks"
            :key="tick.label"
            class="absolute inset-x-0 border-t border-default"
            :style="{ bottom: `${tick.percent}%` }"
          />
        </div>
        <!-- One row of cells, each named by its numbers. The cells hold the roving tab stop, and
             the grid listens for all of them. -->
        <div
          ref="grid"
          role="grid"
          :aria-label="chartName"
          tabindex="-1"
          class="relative outline-none"
          @keydown="onKeydown"
          @mouseover="onMouseover"
          @focusin="onFocusin"
          @focusout="onFocusout"
        >
          <div role="row" class="flex">
            <div
              v-for="(column, index) in columns"
              :key="column.bucket"
              :ref="(element) => keepCell(element, index)"
              role="gridcell"
              :aria-label="column.description"
              :tabindex="index === tabStop ? 0 : -1"
              class="flex min-w-0 flex-1 basis-0 flex-col items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              :class="{ 'bg-elevated': index === shownIndex }"
              data-testid="dashboard-chart-column"
            >
              <div class="flex h-56 w-full items-end justify-center" aria-hidden="true">
                <div
                  class="flex w-[70%] max-w-6 flex-col-reverse gap-0.5 overflow-hidden rounded-t-sm"
                  :style="{ height: `${(column.totalSeconds / scale.topSeconds) * 100}%` }"
                >
                  <div
                    v-for="segment in column.segments"
                    :key="segment.key"
                    class="min-h-0 basis-0"
                    :class="segment.color"
                    :style="{ flexGrow: segment.seconds }"
                    data-testid="dashboard-chart-segment"
                  />
                </div>
              </div>
              <span
                class="h-6 pt-1.5 font-mono text-xs whitespace-nowrap text-muted"
                aria-hidden="true"
              >
                {{ column.short }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <UTooltip
      :open="!!shown"
      :reference="shownElement"
      :content="{ side: 'top', sideOffset: 0 }"
      :ui="{ content: 'h-auto flex-col items-stretch p-0' }"
    >
      <template #content>
        <!-- Fills the whole tooltip and touches the column, so the pointer can move onto it. -->
        <div
          v-if="shown"
          ref="tooltip"
          class="grid gap-1 px-2.5 py-2"
          data-testid="dashboard-chart-tooltip"
        >
          <p class="m-0 flex justify-between gap-4 font-medium">
            <span>{{ shown.long }}</span>
            <span class="font-mono tabular-nums">
              {{ formatReportDuration(shown.totalSeconds) }}
            </span>
          </p>
          <ul class="m-0 grid list-none gap-0.5 p-0">
            <li
              v-for="segment in shown.segments.toReversed()"
              :key="segment.key"
              class="flex items-center gap-2"
            >
              <span class="size-2 shrink-0 rounded-xs" :class="segment.color" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate">{{ segment.name }}</span>
              <span class="font-mono tabular-nums">
                {{ formatReportDuration(segment.seconds) }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </UTooltip>
  </div>
</template>
