<script setup lang="ts">
import type { TableColumn, TableProps } from '@nuxt/ui';
import type { MonthlyReportDto } from '~~/shared/types/report';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { AttentionReason } from '~~/shared/utils/monthly-report-attention';
import { addCalendarMonths, monthDateRange } from '~~/shared/utils/report-month';
import { formatReportDuration } from '~/utils/format-report-duration';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';
import { mapRemoteSyncClientError } from '~/composables/use-remote-sync-client';
import { createRemoteAdapter } from '~/utils/remote/create-remote-adapter';
import {
  buildTimesheetRows,
  cellWarning,
  summarizeRemoteHours,
  type RemoteHoursSummary,
  type RemoteStateByTracker,
  type TimesheetCellKind,
  type TimesheetRow,
  type TrackerCell,
} from '~/utils/monthly-timesheet';

const { t, locale } = useI18n();
usePageTitle(() => t('reports.monthly.pageTitle'));
const route = useRoute();
const router = useRouter();
const requestFetch = useRequestFetch();
const { get: getSecret } = useTrackerSecret();

function firstQueryString(
  value: string | null | undefined | Array<string | null>,
): string | undefined {
  if (value == null || Array.isArray(value)) return undefined;
  return value;
}

const monthQuery = computed(() => firstQueryString(route.query.month));

// Lazy: on the client the await resolves at once and the page fills in (REQ-391);
// on the server it still waits, so SSR and setup logic see the data.
const {
  data: reportData,
  pending: reportPending,
  error: reportError,
} = await useAsyncData(
  () => `reports-monthly:${monthQuery.value ?? 'default'}`,
  () => {
    const month = monthQuery.value;
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return requestFetch<MonthlyReportDto>(`/api/reports/monthly${query}`);
  },
  { watch: [monthQuery], lazy: true },
);

const { data: trackersData, status: trackersStatus } = await useAsyncData(
  'trackers',
  () => requestFetch<TrackerDto[]>('/api/trackers'),
  { lazy: true },
);

watch(
  () => reportData.value?.month,
  (month) => {
    if (!month || monthQuery.value === month) return;
    void router.replace({ path: '/reports/monthly', query: { month } });
  },
  { immediate: true },
);

const reportErrorKey = computed(() =>
  reportError.value
    ? extractCaughtMessageKey(reportError.value, 'reports.monthly.loadError')
    : null,
);

const remoteByTracker = ref<RemoteStateByTracker>({});
const remotesReady = ref(false);

async function loadRemoteHours(report: MonthlyReportDto, configs: TrackerDto[]): Promise<void> {
  remotesReady.value = false;
  const range = monthDateRange(report.month);
  const byId = new Map(configs.map((config) => [config.id, config]));
  const next: RemoteStateByTracker = {};
  await Promise.all(
    report.trackers.map(async (tracker) => {
      const config = byId.get(tracker.id);
      const secret = config ? getSecret(config.id) : null;
      if (!config || !secret) {
        next[tracker.id] = {
          status: 'error',
          logs: [],
          errorKey: 'error.remoteTrackerSecretRequired',
        };
        return;
      }
      try {
        const adapter = createRemoteAdapter(config, secret);
        // REQ-333: the range fetch is already scoped to the current account
        // server-side; no preceding account-resolution call is needed.
        const logs = await adapter.fetchTimeLogsInRange({
          from: range.from,
          to: range.to,
        });
        next[tracker.id] = { status: 'ok', logs, errorKey: null };
      } catch (err) {
        next[tracker.id] = {
          status: 'error',
          logs: [],
          errorKey: mapRemoteSyncClientError(err, 'error.remoteTimeLogsFetchFailed'),
        };
      }
    }),
  );
  remoteByTracker.value = next;
  remotesReady.value = true;
}

watch(
  [reportData, trackersData, trackersStatus],
  ([report, configs, configsStatus]) => {
    // Wait for the tracker configs too, or every tracker would briefly report a missing secret.
    if (!import.meta.client || !report || configsStatus === 'pending') return;
    void loadRemoteHours(report, configs ?? []);
  },
  { immediate: true },
);

const monthLabel = computed(() => {
  const month = reportData.value?.month ?? monthQuery.value;
  if (!month) return '';
  const [year, monthNum] = month.split('-').map(Number);
  if (!year || !monthNum) return month;
  return new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
});

function goMonth(delta: number) {
  const month = reportData.value?.month ?? monthQuery.value;
  if (!month) return;
  void router.push({ path: '/reports/monthly', query: { month: addCalendarMonths(month, delta) } });
}

const ATTENTION_I18N = {
  direct: 'reports.monthly.reasonDirect',
  unexported: 'reports.monthly.reasonUnexported',
  remoteOnly: 'reports.monthly.reasonRemoteOnly',
  fetchFailed: 'reports.monthly.reasonFetchFailed',
} as const;

const rows = computed<TimesheetRow[]>(() =>
  reportData.value
    ? buildTimesheetRows(reportData.value, remoteByTracker.value, remotesReady.value)
    : [],
);

const showEmpty = computed(
  () =>
    !reportPending.value && !reportErrorKey.value && remotesReady.value && rows.value.length === 0,
);

const localTotalSeconds = computed(() =>
  (reportData.value?.days ?? []).reduce((sum, day) => sum + day.localSeconds, 0),
);

const remoteHoursSummary = computed((): RemoteHoursSummary =>
  reportData.value
    ? summarizeRemoteHours(reportData.value, remoteByTracker.value, remotesReady.value)
    : { kind: 'pending' },
);

const showSummaries = computed(() => !reportErrorKey.value);

const SUMMARY_PENDING = '-';

const localSummaryText = computed(() =>
  reportData.value ? formatReportDuration(localTotalSeconds.value) : SUMMARY_PENDING,
);

const remoteSummaryText = computed(() => {
  const summary = remoteHoursSummary.value;
  if (summary.kind === 'pending') return SUMMARY_PENDING;
  if (summary.kind === 'failed') return t('reports.monthly.trackerError');
  return formatReportDuration(summary.seconds);
});

/**
 * Duration cells share the report's numeric face. Plain values sit at 400 so a flagged value
 * (600, warning) differs by weight as well as colour (REQ-472); the totals row is 600.
 */
function durationTd(isTotal: boolean, extra = ''): string {
  const weight = isTotal ? 'font-semibold text-highlighted' : 'font-normal';
  return `text-end font-mono tabular-nums ${weight} ${extra}`;
}

/** A legend entry's sample: the flagged look (warning, semibold, dotted underline) on a word. */
const LEGEND_MARK =
  'me-1 font-semibold text-warning underline decoration-warning/70 decoration-dotted decoration-2 underline-offset-4';

/** Each tracker group opens with the same quiet divider, in both header rows and the body. */
const GROUP_DIVIDER = 'border-s border-default';

// The totals row closes the table with a divider-weight rule and its semibold figures, on the
// same untinted ground as every other table.
const tableMeta: TableProps<TimesheetRow>['meta'] = {
  class: {
    tr: (row) => (row.original.isTotal ? 'border-t border-default' : ''),
  },
};

/**
 * The day as "czw., 5 lis" (locale order): the weekday muted and right before the date it names,
 * so a month scans by week without a floating weekday column. Day keys are calendar dates, so
 * they format in UTC to stay on the same day.
 */
function dayParts(date: string) {
  const parts = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const weekdayAt = parts.findIndex((part) => part.type === 'weekday');
  // The weekday and the literal right after it ("czw., ") form the muted lead, when it leads.
  if (weekdayAt !== 0) return { weekday: '', rest: parts.map((part) => part.value).join('') };
  const leadEnd = parts[1]?.type === 'literal' ? 2 : 1;
  return {
    weekday: parts
      .slice(0, leadEnd)
      .map((part) => part.value)
      .join(''),
    rest: parts
      .slice(leadEnd)
      .map((part) => part.value)
      .join(''),
  };
}

/**
 * Date and Local have no group above them, so their headings sit in the lower header row under
 * an empty cell. Lifting the label by half a header row centres it across both rows.
 */
function spanningHeader(label: string) {
  return () => h('span', { class: 'relative -top-[1.125rem]' }, label);
}

function flaggedDuration(input: {
  text: string;
  testId: string;
  warning: AttentionReason | null;
  warningTestId?: string;
  dimZero?: boolean;
  zero?: boolean;
}) {
  if (input.warning) {
    const reason = t(ATTENTION_I18N[input.warning]);
    // Colour, weight and a dotted underline: the underline is the cue that survives without
    // colour (WCAG 1.4.1), and it is the usual sign that a value explains itself on hover.
    return h(resolveComponent('UTooltip'), { text: reason, content: { side: 'bottom' } }, () =>
      h(
        'span',
        {
          tabindex: 0,
          class:
            'rounded-sm font-semibold text-warning underline decoration-warning/70 decoration-dotted decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary',
          'data-testid': input.warningTestId ?? input.testId,
          'aria-label': `${input.text}. ${reason}`,
        },
        input.text,
      ),
    );
  }
  return h(
    'span',
    {
      // Zeros recede by weight and by a quiet neutral grey one step below the dimmed tone (about
      // 4.7:1 in both themes, still AA), so the grid stops reading as a sea of zeros. Dark mode
      // uses a near-neutral slate: the ramp's bluer grey read as accent at this size.
      class:
        input.dimZero && input.zero
          ? 'font-light text-neutral-500 dark:font-[270] dark:text-[oklch(64%_0.012_262)]'
          : undefined,
      'data-testid': input.testId,
    },
    input.text,
  );
}

function durationCell(
  row: TimesheetRow,
  cell: TrackerCell | undefined,
  kind: TimesheetCellKind,
  trackerId: string,
) {
  const testId = `reports-tracker-${trackerId}-${row.date}-${kind}`;
  if (!cell || cell.failed) {
    const failedText = t('reports.monthly.trackerError');
    if (row.isTotal) {
      return h('span', { 'data-testid': testId }, failedText);
    }
    return h('span', { 'data-testid': testId }, [
      flaggedDuration({
        text: failedText,
        testId,
        warning: 'fetchFailed',
        warningTestId: `reports-warning-${row.date}-fetch-${trackerId}`,
      }),
    ]);
  }
  const seconds =
    kind === 'app'
      ? cell.appSeconds
      : kind === 'direct'
        ? cell.directSeconds
        : cell.appSeconds + cell.directSeconds;
  const warning = cellWarning(row, cell, kind);
  const text = formatReportDuration(seconds);
  if (warning) {
    return h('span', { 'data-testid': testId }, [
      flaggedDuration({
        text,
        testId,
        warning,
        warningTestId: `reports-warning-${row.date}-${kind}-${trackerId}`,
      }),
    ]);
  }
  return flaggedDuration({
    text,
    testId,
    warning: null,
    dimZero: true,
    zero: seconds === 0,
  });
}

const columns = computed<TableColumn<TimesheetRow>[]>(() => {
  const report = reportData.value;
  const trackers = report?.trackers ?? [];
  const dateCol: TableColumn<TimesheetRow> = {
    accessorKey: 'date',
    header: spanningHeader(t('reports.monthly.columnDate')),
    meta: {
      class: {
        th: 'w-28 align-bottom',
        td: ({ row }) =>
          `text-highlighted ${row.original.isTotal ? 'font-semibold' : 'font-medium'}`,
      },
    },
    cell: ({ row }) => {
      const testId = `reports-day-${row.original.date}`;
      if (row.original.isTotal) {
        return h('span', { 'data-testid': testId }, t('reports.monthly.totals'));
      }
      const { weekday, rest } = dayParts(row.original.date);
      return h('span', { 'data-testid': testId }, [
        h('span', { class: 'font-normal text-muted' }, weekday),
        rest,
      ]);
    },
  };
  const localCol: TableColumn<TimesheetRow> = {
    accessorKey: 'localSeconds',
    header: spanningHeader(t('reports.monthly.columnLocal')),
    meta: {
      class: {
        th: 'w-24 text-end align-bottom',
        td: ({ row }) => durationTd(row.original.isTotal),
      },
    },
    cell: ({ row }) => {
      const text = formatReportDuration(row.original.localSeconds);
      const testId = `reports-local-${row.original.date}`;
      if (row.original.warnUnexported) {
        return h('span', { 'data-testid': testId }, [
          flaggedDuration({
            text,
            testId,
            warning: 'unexported',
            warningTestId: `reports-warning-${row.original.date}-local`,
          }),
        ]);
      }
      return flaggedDuration({
        text,
        testId,
        warning: null,
        dimZero: true,
        zero: row.original.localSeconds === 0,
      });
    },
  };
  const trackerCols: TableColumn<TimesheetRow>[] = trackers.map((tracker) => ({
    id: tracker.id,
    header: () => h('span', { 'data-testid': `reports-tracker-group-${tracker.id}` }, tracker.name),
    enableSorting: false,
    meta: {
      class: {
        // Aligned to its group's start, after the group divider, like a section label over its
        // three columns. The table is fixed-layout (Date and Local fixed, every Tracker column
        // an equal share of the rest), so numbers hold their place whatever the headings.
        th: `py-2 text-start text-[0.8125rem] text-highlighted border-b ${GROUP_DIVIDER}`,
      },
    },
    columns: [
      {
        id: `${tracker.id}-app`,
        header: t('reports.monthly.columnExported'),
        enableSorting: false,
        meta: {
          class: {
            th: `ps-2 text-end whitespace-nowrap ${GROUP_DIVIDER}`,
            td: ({ row }) => durationTd(row.original.isTotal, GROUP_DIVIDER),
          },
        },
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'app', tracker.id),
      },
      {
        id: `${tracker.id}-direct`,
        header: t('reports.monthly.columnDirect'),
        enableSorting: false,
        meta: {
          class: {
            th: 'ps-2 text-end whitespace-nowrap',
            td: ({ row }) => durationTd(row.original.isTotal),
          },
        },
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'direct', tracker.id),
      },
      {
        id: `${tracker.id}-total`,
        header: t('reports.monthly.columnTotal'),
        enableSorting: false,
        meta: {
          class: {
            th: 'ps-2 text-end whitespace-nowrap',
            td: ({ row }) => durationTd(row.original.isTotal),
          },
        },
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'total', tracker.id),
      },
    ],
  }));
  return [dateCol, localCol, ...trackerCols];
});
</script>

<template>
  <div data-testid="reports-monthly" class="space-y-6">
    <PageHeader :title="t('reports.monthly.pageTitle')">
      <PeriodStepper
        :prev-label="t('reports.monthly.previousMonth')"
        :next-label="t('reports.monthly.nextMonth')"
        prev-testid="reports-month-prev"
        next-testid="reports-month-next"
        @prev="goMonth(-1)"
        @next="goMonth(1)"
      >
        <PeriodLabel data-testid="reports-month-label">
          {{ capitalizeFirst(monthLabel, locale) }}
        </PeriodLabel>
      </PeriodStepper>
    </PageHeader>

    <p v-if="reportErrorKey" data-testid="reports-monthly-error" class="text-error" role="alert">
      {{ t(reportErrorKey) }}
    </p>

    <!-- Month totals: the shared stat cards, side by side across the content width. -->
    <div
      v-if="showSummaries"
      class="grid grid-cols-2 gap-4"
      data-testid="reports-monthly-summaries"
      aria-live="polite"
    >
      <StatCard :label="t('reports.monthly.summaryLocal')" icon="i-lucide-hard-drive">
        <span
          :class="localSummaryText === SUMMARY_PENDING ? 'text-dimmed' : undefined"
          data-testid="reports-summary-local"
        >
          {{ localSummaryText }}
        </span>
        <template #caption>{{ t('reports.monthly.summaryLocalCaption') }}</template>
      </StatCard>

      <StatCard :label="t('reports.monthly.summaryRemote')" icon="i-lucide-cable">
        <span
          v-if="remoteHoursSummary.kind === 'ok' || remoteHoursSummary.kind === 'pending'"
          :class="remoteSummaryText === SUMMARY_PENDING ? 'text-dimmed' : undefined"
          data-testid="reports-summary-remote"
        >
          {{ remoteSummaryText }}
        </span>
        <!-- An incomplete total: warning colour, weight, an icon and a tooltip, never colour alone. -->
        <UTooltip
          v-else-if="remoteHoursSummary.kind === 'partial'"
          :text="t('reports.monthly.summaryRemotePartial')"
          :content="{ side: 'bottom' }"
        >
          <span
            tabindex="0"
            class="inline-flex items-center gap-2 rounded-sm font-semibold text-warning focus-visible:outline-2 focus-visible:outline-primary"
            data-testid="reports-summary-remote"
          >
            {{ remoteSummaryText }}
            <UIcon name="i-lucide-triangle-alert" class="size-5" aria-hidden="true" />
          </span>
        </UTooltip>
        <span
          v-else
          class="inline-flex items-center gap-2 font-sans text-base font-medium text-error"
          data-testid="reports-summary-remote"
          :aria-label="t('reports.monthly.summaryRemoteFailed')"
        >
          <UIcon name="i-lucide-circle-alert" class="size-5 shrink-0" aria-hidden="true" />
          {{ remoteSummaryText }}
        </span>
        <template #caption>
          <span v-if="remoteHoursSummary.kind === 'partial'" class="text-warning">
            {{ t('reports.monthly.summaryRemotePartialCaption') }}
          </span>
          <template v-else>{{ t('reports.monthly.summaryRemoteCaption') }}</template>
        </template>
      </StatCard>
    </div>

    <p v-if="!reportErrorKey && showEmpty" class="text-muted" data-testid="reports-monthly-empty">
      {{ t('reports.monthly.empty') }}
    </p>

    <!-- The shared table style: 44px rows, quiet headers on the card's own ground. -->
    <UTable
      v-if="!reportErrorKey && !showEmpty"
      :data="rows"
      :columns="columns"
      :meta="tableMeta"
      :loading="reportPending"
      :ui="{
        root: 'rounded-xl bg-default ring ring-default dark:bg-muted',
        base: 'w-full table-fixed',
      }"
      :data-testid="remotesReady ? 'reports-monthly-table-ready' : 'reports-monthly-table'"
      class="w-full"
    />
    <!-- The legend (REQ-472): what the underlined values usually mean, read at a glance, then how
         to see each value's own reason. Helper text, so 14px. -->
    <div
      v-if="!reportErrorKey && !showEmpty"
      class="-mt-1 flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 text-sm text-muted"
      data-testid="reports-monthly-legend"
    >
      <span>
        <span :class="LEGEND_MARK">{{ t('reports.monthly.columnLocal') }}</span>
        {{ t('reports.monthly.legendLocal') }}
      </span>
      <span>
        <span :class="LEGEND_MARK">{{ t('reports.monthly.columnDirect') }}</span>
        {{ t('reports.monthly.legendDirect') }}
      </span>
      <span class="text-dimmed">{{ t('reports.monthly.legend') }}</span>
    </div>
  </div>
</template>
