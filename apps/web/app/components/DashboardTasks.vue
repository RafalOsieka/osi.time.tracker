<script setup lang="ts">
import { DASHBOARD_TOP_TASKS, type DashboardTaskDto } from '~~/shared/types/dashboard';
import { formatReportDuration } from '~/utils/format-report-duration';

/** The Tasks that took the most time in the period, each with its Project and Remote issue. */
const { tasks, loading } = defineProps<{
  tasks: DashboardTaskDto[] | undefined;
  /** The Tasks belong to a period being left, so placeholders stand in for them. */
  loading: boolean;
}>();

const { t } = useI18n();

/** The issue's id with its cached title, for the tooltip and the screen reader. */
function issueName({ id, title }: NonNullable<DashboardTaskDto['remoteIssue']>): string {
  return `#${id}: ${title}`;
}
</script>

<template>
  <section
    class="grid content-start gap-4 rounded-xl bg-default p-4 ring ring-default dark:bg-muted"
    aria-labelledby="dashboard-tasks-heading"
    :aria-busy="loading"
    data-testid="dashboard-tasks"
  >
    <h2 id="dashboard-tasks-heading" class="m-0 text-base font-semibold text-highlighted">
      {{ t('dashboard.tasks.heading') }}
    </h2>

    <div v-if="loading || !tasks" class="grid gap-3" aria-hidden="true">
      <USkeleton v-for="row in DASHBOARD_TOP_TASKS" :key="row" class="h-9" />
    </div>
    <p v-else-if="!tasks.length" class="text-sm text-muted" data-testid="dashboard-tasks-empty">
      {{ t('dashboard.tasks.empty') }}
    </p>
    <!-- A plain table like the groups table: the Task's name is its row's header. -->
    <table v-else class="w-full table-fixed" data-testid="dashboard-tasks-table">
      <caption class="sr-only">
        {{ t('dashboard.tasks.caption') }}
      </caption>
      <thead class="text-xs text-muted">
        <tr class="*:py-2 *:font-medium">
          <th scope="col" class="pe-2 text-start">{{ t('dashboard.tasks.columnTask') }}</th>
          <th scope="col" class="w-28 px-2 text-start">{{ t('dashboard.tasks.columnIssue') }}</th>
          <th scope="col" class="w-20 ps-2 text-end">{{ t('dashboard.columnTime') }}</th>
        </tr>
      </thead>
      <tbody class="text-sm">
        <tr v-for="task in tasks" :key="task.id" class="border-t border-default *:py-2.5">
          <th scope="row" class="pe-2 text-start font-normal wrap-anywhere">
            <span class="block font-medium text-highlighted">{{ task.name }}</span>
            <span class="block text-xs text-muted">
              {{ task.project?.name ?? t('dashboard.group.noProject') }}
              <UBadge
                v-if="task.project?.deleted"
                color="neutral"
                variant="soft"
                size="sm"
                :label="t('dashboard.deleted')"
              />
            </span>
          </th>
          <td class="px-2 font-mono tabular-nums">
            <template v-if="task.remoteIssue">
              <UTooltip :text="issueName(task.remoteIssue)">
                <ULink
                  v-if="task.remoteIssue.url"
                  :to="task.remoteIssue.url"
                  target="_blank"
                  external
                  class="text-default underline-offset-2 hover:text-primary hover:underline"
                  data-testid="dashboard-task-issue"
                >
                  <span aria-hidden="true">#{{ task.remoteIssue.id }}</span>
                  <span class="sr-only">{{ issueName(task.remoteIssue) }}</span>
                </ULink>
                <!-- Focusable, so that the keyboard reaches the tooltip too. -->
                <span v-else tabindex="0" data-testid="dashboard-task-issue">
                  <span aria-hidden="true">#{{ task.remoteIssue.id }}</span>
                  <span class="sr-only">{{ issueName(task.remoteIssue) }}</span>
                </span>
              </UTooltip>
            </template>
          </td>
          <td class="ps-2 text-end font-mono tabular-nums">
            {{ formatReportDuration(task.totalSeconds) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
