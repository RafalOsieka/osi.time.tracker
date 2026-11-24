<script setup lang="ts">
import {
  DASHBOARD_GROUPINGS,
  type DashboardDto,
  type DashboardGroupDto,
  type DashboardGrouping,
} from '~~/shared/types/dashboard';
import { formatReportDuration } from '~/utils/format-report-duration';

/** How the period's time splits over Projects or Trackers. */
const { groups, totalSeconds, loading } = defineProps<{
  groups: DashboardDto['groups'] | undefined;
  /** The period's total, which a share is a part of. */
  totalSeconds: number;
  /** The groups belong to a period being left, so placeholders stand in for them. */
  loading: boolean;
}>();
const grouping = defineModel<DashboardGrouping>('grouping', { required: true });

const { t, locale } = useI18n();

const groupings = computed(() =>
  DASHBOARD_GROUPINGS.map((value) => ({ value, label: t(`dashboard.grouping.${value}`) })),
);

const percent = computed(() => new Intl.NumberFormat(locale.value, { style: 'percent' }));

function groupName(group: DashboardGroupDto): string {
  return 'name' in group ? group.name : t(`dashboard.group.${group.kind}`);
}
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

    <USkeleton v-if="loading || !groups" class="h-40 w-full rounded-xl" aria-hidden="true" />
    <!-- A plain table in the shared table style: UTable cannot mark a group's name as its row's
         header, so a screen reader would read the numbers of a column without the group. -->
    <div v-else class="relative rounded-xl bg-default ring ring-default dark:bg-muted">
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
            v-for="group in groups[grouping]"
            :key="'id' in group ? group.id : group.kind"
            class="border-t border-default *:px-4 *:py-3"
          >
            <th scope="row" class="text-start font-medium wrap-anywhere text-highlighted">
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
              {{ percent.format(group.totalSeconds / totalSeconds) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
