<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { MonthlyReportDto } from '~~/shared/types/report';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { RemoteTimeLogDto } from '~~/shared/types/remote-export';
import type { AttentionReason } from '~~/shared/utils/monthly-report-attention';
import { attentionReasons } from '~~/shared/utils/monthly-report-attention';
import { splitAppAndDirect } from '~~/shared/utils/monthly-report-split';
import { addCalendarMonths, monthDateRange } from '~~/shared/utils/report-month';
import { formatReportDuration } from '~/utils/format-report-duration';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';
import { mapRemoteSyncClientError } from '~/composables/use-remote-sync-client';
import { createRemoteAdapter } from '~/utils/remote/create-remote-adapter';

interface TrackerRemoteState {
  status: 'loading' | 'ok' | 'error';
  logs: RemoteTimeLogDto[];
  errorKey: string | null;
}

interface TrackerCell {
  appSeconds: number;
  directSeconds: number;
  failed: boolean;
}

interface TimesheetRow {
  date: string;
  isTotal: boolean;
  localSeconds: number;
  trackerCells: Record<string, TrackerCell>;
  warnUnexported: boolean;
}

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
  { watch: [monthQuery] },
);

const { data: trackersData } = await useAsyncData('trackers', () =>
  requestFetch<TrackerDto[]>('/api/trackers'),
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

const remoteByTracker = ref<Record<string, TrackerRemoteState>>({});
const remotesReady = ref(false);

async function loadRemoteHours(report: MonthlyReportDto, configs: TrackerDto[]): Promise<void> {
  remotesReady.value = false;
  const range = monthDateRange(report.month);
  const byId = new Map(configs.map((config) => [config.id, config]));
  const next: Record<string, TrackerRemoteState> = {};
  await Promise.all(
    report.trackers.map(async (tracker) => {
      const config = byId.get(tracker.id);
      const secret = config ? getSecret(config.id) : null;
      if (!config || !secret) {
        next[tracker.id] = {
          status: 'error',
          logs: [],
          errorKey: 'error.remoteServerModeSecretRequired',
        };
        return;
      }
      try {
        const adapter = createRemoteAdapter(config, secret);
        const account = await adapter.getCurrentAccount();
        const logs = await adapter.fetchTimeLogsInRange({
          from: range.from,
          to: range.to,
          userId: account.id,
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
  [reportData, trackersData],
  ([report, configs]) => {
    if (!import.meta.client || !report) return;
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

const rows = computed<TimesheetRow[]>(() => {
  const report = reportData.value;
  if (!report) return [];
  const knownIds = new Set(report.exports.map((item) => item.remoteLogId));
  const hoursByTracker = new Map<
    string,
    Map<string, { appSeconds: number; directSeconds: number }>
  >();
  const dates = new Set(report.days.map((day) => day.date));
  for (const tracker of report.trackers) {
    const remote = remoteByTracker.value[tracker.id];
    if (remote?.status === 'ok') {
      const split = splitAppAndDirect(remote.logs, knownIds);
      hoursByTracker.set(tracker.id, split);
      for (const date of split.keys()) dates.add(date);
    }
  }
  const localByDate = new Map(report.days.map((day) => [day.date, day.localSeconds]));
  const sorted = [...dates].sort((left, right) => left.localeCompare(right));
  const dayRows: TimesheetRow[] = sorted.map((date) => {
    const trackerCells: Record<string, TrackerCell> = {};
    const attentionTrackers: {
      appSeconds: number;
      directSeconds: number;
      fetchFailed: boolean;
    }[] = [];
    for (const tracker of report.trackers) {
      const remote = remoteByTracker.value[tracker.id];
      const failed = remote?.status === 'error';
      const hours = hoursByTracker.get(tracker.id)?.get(date) ?? {
        appSeconds: 0,
        directSeconds: 0,
      };
      trackerCells[tracker.id] = { ...hours, failed: !!failed };
      attentionTrackers.push({
        appSeconds: hours.appSeconds,
        directSeconds: hours.directSeconds,
        fetchFailed: !!failed,
      });
    }
    const localSeconds = localByDate.get(date) ?? 0;
    const reasons = remotesReady.value
      ? attentionReasons({ localSeconds, trackers: attentionTrackers })
      : [];
    return {
      date,
      isTotal: false,
      localSeconds,
      trackerCells,
      warnUnexported: reasons.includes('unexported'),
    };
  });
  if (dayRows.length === 0) return [];
  const totals: TimesheetRow = {
    date: 'total',
    isTotal: true,
    localSeconds: dayRows.reduce((sum, row) => sum + row.localSeconds, 0),
    trackerCells: {},
    warnUnexported: false,
  };
  for (const tracker of report.trackers) {
    const failed = remoteByTracker.value[tracker.id]?.status === 'error';
    totals.trackerCells[tracker.id] = {
      appSeconds: dayRows.reduce(
        (sum, row) => sum + (row.trackerCells[tracker.id]?.appSeconds ?? 0),
        0,
      ),
      directSeconds: dayRows.reduce(
        (sum, row) => sum + (row.trackerCells[tracker.id]?.directSeconds ?? 0),
        0,
      ),
      failed: !!failed,
    };
  }
  return [...dayRows, totals];
});

const showEmpty = computed(
  () =>
    !reportPending.value && !reportErrorKey.value && remotesReady.value && rows.value.length === 0,
);

const localTotalSeconds = computed(() =>
  (reportData.value?.days ?? []).reduce((sum, day) => sum + day.localSeconds, 0),
);

type RemoteHoursSummary =
  | { kind: 'pending' }
  | { kind: 'ok'; seconds: number }
  | { kind: 'partial'; seconds: number }
  | { kind: 'failed' };

const remoteHoursSummary = computed((): RemoteHoursSummary => {
  const report = reportData.value;
  if (!report || !remotesReady.value) return { kind: 'pending' };
  if (report.trackers.length === 0) return { kind: 'ok', seconds: 0 };
  let seconds = 0;
  let okCount = 0;
  let failedCount = 0;
  for (const tracker of report.trackers) {
    const remote = remoteByTracker.value[tracker.id];
    if (remote?.status === 'ok') {
      okCount += 1;
      for (const log of remote.logs) seconds += log.durationSeconds;
    } else if (remote?.status === 'error') {
      failedCount += 1;
    }
  }
  if (okCount === 0 && failedCount > 0) return { kind: 'failed' };
  if (failedCount > 0) return { kind: 'partial', seconds };
  return { kind: 'ok', seconds };
});

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

function formatDay(date: string, isTotal: boolean): string {
  if (isTotal) return t('reports.monthly.totals');
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
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
    return h(resolveComponent('UTooltip'), { text: reason, content: { side: 'bottom' } }, () =>
      h(
        'span',
        {
          tabindex: 0,
          class: 'text-warning font-semibold',
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
      class: input.dimZero && input.zero ? 'text-dimmed opacity-40' : undefined,
      'data-testid': input.testId,
    },
    input.text,
  );
}

function durationCell(
  row: TimesheetRow,
  cell: TrackerCell | undefined,
  kind: 'app' | 'direct' | 'total',
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
  let warning: AttentionReason | null = null;
  if (!row.isTotal) {
    if (kind === 'direct' && cell.directSeconds > 0) warning = 'direct';
    else if (
      kind === 'app' &&
      row.localSeconds === 0 &&
      cell.appSeconds > 0 &&
      cell.directSeconds === 0
    ) {
      warning = 'remoteOnly';
    }
  }
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
    header: t('reports.monthly.columnDate'),
    cell: ({ row }) =>
      h(
        'span',
        { 'data-testid': `reports-day-${row.original.date}` },
        formatDay(row.original.date, row.original.isTotal),
      ),
  };
  const localCol: TableColumn<TimesheetRow> = {
    accessorKey: 'localSeconds',
    header: t('reports.monthly.columnLocal'),
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
        th: 'text-center border-s border-b border-default',
      },
    },
    columns: [
      {
        id: `${tracker.id}-app`,
        header: t('reports.monthly.columnExported'),
        enableSorting: false,
        meta: {
          class: {
            th: 'border-s border-default',
            td: 'border-s border-default',
          },
        },
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'app', tracker.id),
      },
      {
        id: `${tracker.id}-direct`,
        header: t('reports.monthly.columnDirect'),
        enableSorting: false,
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'direct', tracker.id),
      },
      {
        id: `${tracker.id}-total`,
        header: t('reports.monthly.columnTotal'),
        enableSorting: false,
        cell: ({ row }) =>
          durationCell(row.original, row.original.trackerCells[tracker.id], 'total', tracker.id),
      },
    ],
  }));
  return [dateCol, localCol, ...trackerCols];
});
</script>

<template>
  <div data-testid="reports-monthly" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">{{ t('reports.monthly.pageTitle') }}</h1>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          :aria-label="t('reports.monthly.previousMonth')"
          data-testid="reports-month-prev"
          @click="goMonth(-1)"
        />
        <span data-testid="reports-month-label" class="min-w-40 text-center font-medium">
          {{ monthLabel }}
        </span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          :aria-label="t('reports.monthly.nextMonth')"
          data-testid="reports-month-next"
          @click="goMonth(1)"
        />
      </div>
    </div>

    <p v-if="reportErrorKey" data-testid="reports-monthly-error" class="text-error" role="alert">
      {{ t(reportErrorKey) }}
    </p>

    <div
      v-if="showSummaries"
      class="flex flex-wrap items-center gap-2"
      data-testid="reports-monthly-summaries"
      aria-live="polite"
    >
      <UBadge color="neutral" variant="subtle" data-testid="reports-summary-local">
        {{ t('reports.monthly.summaryLocal') }}:
        <span
          class="inline-block min-w-[4ch] tabular-nums"
          :class="localSummaryText === SUMMARY_PENDING ? 'text-dimmed' : undefined"
        >
          {{ localSummaryText }}
        </span>
      </UBadge>
      <UBadge
        v-if="remoteHoursSummary.kind === 'ok' || remoteHoursSummary.kind === 'pending'"
        color="neutral"
        variant="subtle"
        data-testid="reports-summary-remote"
      >
        {{ t('reports.monthly.summaryRemote') }}:
        <span
          class="inline-block min-w-[4ch] tabular-nums"
          :class="remoteSummaryText === SUMMARY_PENDING ? 'text-dimmed' : undefined"
        >
          {{ remoteSummaryText }}
        </span>
      </UBadge>
      <UTooltip
        v-else-if="remoteHoursSummary.kind === 'partial'"
        :text="t('reports.monthly.summaryRemotePartial')"
        :content="{ side: 'bottom' }"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="warning" variant="subtle" data-testid="reports-summary-remote">
            {{ t('reports.monthly.summaryRemote') }}:
            <span class="inline-block min-w-[4ch] tabular-nums">{{ remoteSummaryText }}</span>
          </UBadge>
        </span>
      </UTooltip>
      <UBadge
        v-else
        color="error"
        variant="subtle"
        data-testid="reports-summary-remote"
        :aria-label="t('reports.monthly.summaryRemoteFailed')"
      >
        {{ t('reports.monthly.summaryRemote') }}:
        {{ remoteSummaryText }}
      </UBadge>
    </div>

    <p v-if="!reportErrorKey && showEmpty" data-testid="reports-monthly-empty">
      {{ t('reports.monthly.empty') }}
    </p>

    <UTable
      v-if="!reportErrorKey && !showEmpty"
      :data="rows"
      :columns="columns"
      :loading="reportPending"
      :data-testid="remotesReady ? 'reports-monthly-table-ready' : 'reports-monthly-table'"
      class="w-full"
    />
  </div>
</template>
