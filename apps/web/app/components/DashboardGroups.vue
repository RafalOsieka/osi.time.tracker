<script setup lang="ts">
import {
  DASHBOARD_COLOR_SLOTS,
  DASHBOARD_GROUPINGS,
  dashboardGroupKey,
  type DashboardDto,
  type DashboardGroupDto,
  type DashboardGrouping,
} from '~~/shared/types/dashboard';
import { formatReportDuration } from '~/utils/format-report-duration';

/** How the period's time splits over Projects or Trackers: a chart and a table beside it. */
const { dashboard, loading } = defineProps<{
  dashboard: Pick<DashboardDto, 'groups' | 'buckets' | 'period' | 'summary'> | undefined;
  /** The groups belong to a period being left, so placeholders stand in for them. */
  loading: boolean;
}>();
const grouping = defineModel<DashboardGrouping>('grouping', { required: true });

const { t, locale } = useI18n();

type ChartColor = `bg-chart-${string}`;

// Full class names, so Tailwind finds them.
const SLOT_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
] as const satisfies { length: typeof DASHBOARD_COLOR_SLOTS };
const OTHER_COLOR: ChartColor = 'bg-chart-other';

const groupings = computed(() =>
  DASHBOARD_GROUPINGS.map((value) => ({ value, label: t(`dashboard.grouping.${value}`) })),
);

const percent = computed(() => new Intl.NumberFormat(locale.value, { style: 'percent' }));

function groupName(group: DashboardGroupDto): string {
  return 'name' in group ? group.name : t(`dashboard.group.${group.kind}`);
}

/** A group without a slot is drawn as part of "Other". */
function groupColor(group: DashboardGroupDto): ChartColor {
  if (group.kind === 'noProject') return 'bg-chart-no-project';
  return group.colorSlot === null ? OTHER_COLOR : (SLOT_COLORS[group.colorSlot] ?? OTHER_COLOR);
}

const groups = computed(() => dashboard?.groups[grouping.value] ?? []);

function toSeries(group: DashboardGroupDto) {
  return {
    key: dashboardGroupKey(group),
    name: groupName(group),
    color: groupColor(group),
    bucketSeconds: group.bucketSeconds,
  };
}

/** Bottom to top: the colored groups largest first, then "Other" and "No project". */
const series = computed(() => {
  const colored = groups.value.filter((group) => group.colorSlot !== null).map(toSeries);
  const folded = groups.value.filter(
    (group) => group.colorSlot === null && group.kind !== 'noProject',
  );
  const other = folded.length
    ? [
        {
          key: 'other',
          name: t('dashboard.group.other'),
          color: OTHER_COLOR,
          bucketSeconds: (dashboard?.buckets ?? []).map((_, index) =>
            folded.reduce((sum, group) => sum + (group.bucketSeconds[index] ?? 0), 0),
          ),
        },
      ]
    : [];
  const noProject = groups.value.filter((group) => group.kind === 'noProject').map(toSeries);
  return [...colored, ...other, ...noProject];
});
</script>

<template>
  <section
    class="grid gap-4"
    aria-labelledby="dashboard-groups-heading"
    :aria-busy="loading"
    data-testid="dashboard-groups"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="dashboard-groups-heading" class="m-0 text-base font-semibold text-highlighted">
        {{ t('dashboard.timeInPeriod') }}
      </h2>
      <UFieldGroup role="group" :aria-label="t('dashboard.groupBy')">
        <UButton
          v-for="option in groupings"
          :key="option.value"
          :label="option.label"
          color="neutral"
          variant="outline"
          :active="option.value === grouping"
          active-color="primary"
          active-variant="subtle"
          active-class="font-semibold"
          :aria-pressed="option.value === grouping"
          :data-testid="`dashboard-grouping-${option.value}`"
          @click="grouping = option.value"
        />
      </UFieldGroup>
    </div>

    <div class="flex min-w-0 flex-wrap items-start gap-4">
      <!-- The chart's placeholder has its size, so the chart does not move on arrival. -->
      <template v-if="loading || !dashboard">
        <USkeleton class="h-72 min-w-0 flex-[3_1_26rem] rounded-xl" aria-hidden="true" />
        <USkeleton class="h-40 min-w-0 flex-[2_1_18rem] rounded-xl" aria-hidden="true" />
      </template>
      <template v-else>
        <div
          class="min-h-72 min-w-0 flex-[3_1_26rem] rounded-xl bg-default p-4 ring ring-default dark:bg-muted"
        >
          <DashboardChart
            :series="series"
            :buckets="dashboard.buckets"
            :kind="dashboard.period.kind"
            :grouping="grouping"
          />
        </div>
        <!-- A plain table in the shared table style: UTable cannot mark a group's name as its
             row's header, so a screen reader would read the numbers of a column without the
             group. -->
        <div
          class="relative min-w-0 flex-[2_1_18rem] rounded-xl bg-default ring ring-default dark:bg-muted"
        >
          <table class="w-full table-fixed" data-testid="dashboard-groups-table">
            <caption class="sr-only">
              {{ t(`dashboard.groupsCaption.${grouping}`) }}
            </caption>
            <thead class="text-xs text-muted">
              <tr class="*:px-4 *:py-2.5 *:font-medium">
                <th scope="col" class="text-start">{{ t(`dashboard.grouping.${grouping}`) }}</th>
                <th scope="col" class="w-24 text-end">{{ t('dashboard.columnTime') }}</th>
                <th scope="col" class="w-20 text-end">{{ t('dashboard.columnShare') }}</th>
              </tr>
            </thead>
            <tbody class="text-sm">
              <tr
                v-for="group in groups"
                :key="dashboardGroupKey(group)"
                class="border-t border-default *:px-4 *:py-3"
              >
                <th scope="row" class="text-start font-medium wrap-anywhere text-highlighted">
                  <span
                    class="me-2 inline-block size-2.5 rounded-xs"
                    :class="groupColor(group)"
                    aria-hidden="true"
                    data-testid="dashboard-group-swatch"
                  />
                  {{ groupName(group) }}
                  <UBadge
                    v-if="'deleted' in group && group.deleted"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :label="t('dashboard.deleted')"
                  />
                </th>
                <td class="text-end font-mono tabular-nums">
                  {{ formatReportDuration(group.totalSeconds) }}
                </td>
                <td class="text-end font-mono text-muted tabular-nums">
                  {{ percent.format(group.totalSeconds / dashboard.summary.totalSeconds) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </section>
</template>
