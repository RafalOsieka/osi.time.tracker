<script setup lang="ts">
import type {
  RemoteSyncConfigSurfaceDto,
  RemoteSyncDayDto,
  RemoteSyncDayRowDto,
  RemoteSyncRowState,
} from '~~/shared/types/remote-sync-day';
import type { TrackerDto } from '~~/shared/types/tracker';
import type {
  ActivityByTask,
  DismissedDuplicatesByTask,
  ExportCommentsByTask,
  IssueRefByTask,
} from '~/types/sync-ui-maps';

type ExportDialogPhase = 'review' | 'running' | 'report';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
// Forwards the incoming request cookies during SSR so the day aggregate is
// authenticated the same way as browser navigations (plain $fetch is not).
const requestFetch = useRequestFetch();

const date = computed(() => String(route.params.date));
usePageTitle(() => t('remoteSync.pageTitle'));

const {
  data,
  pending,
  error: fetchError,
  refresh,
} = useAsyncData<RemoteSyncDayDto>(
  () => `sync-day-${date.value}`,
  () =>
    requestFetch<RemoteSyncDayDto>('/api/sync/day', {
      query: { date: date.value },
    }),
  { watch: [date] },
);

const rows = computed(() => data.value?.rows ?? []);
const untitledTotal = computed(() => data.value?.untitledTotalSeconds ?? 0);
const isEmpty = computed(
  () => !pending.value && !fetchError.value && rows.value.length === 0 && untitledTotal.value === 0,
);

/**
 * Locale-aware day heading. SSR and hydration keep the ISO date so Node vs
 * browser `toLocaleDateString` cannot mismatch; format after mount.
 */
const dayHeadingText = ref(date.value);
function refreshDayHeading() {
  dayHeadingText.value = new Date(`${date.value}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: effective.value.timeZone,
  });
}
watch([date, locale, () => effective.value.timeZone], refreshDayHeading);
onMounted(refreshDayHeading);

function toPickerConfig(config: RemoteSyncConfigSurfaceDto): TrackerDto {
  return {
    id: config.id,
    name: '',
    systemType: config.systemType,
    baseUrl: config.baseUrl,
    executionMode: config.executionMode,
    roundingRule: config.roundingRule,
    createdAt: '',
    updatedAt: '',
  };
}

// --- Local page orchestration state (parallel named task-keyed maps) ---
const activitySelections = ref<ActivityByTask>({});
const localIssueRefs = ref<IssueRefByTask>({});
const expanded = ref<Record<string, boolean>>({});
const dismissedDuplicates = ref<DismissedDuplicatesByTask>({});
const exportComments = ref<ExportCommentsByTask>({});
const editingTitleTaskId = ref<string | null>(null);
const titleEditSnapshot = ref<Record<string, string>>({});
const editingToSendTaskId = ref<string | null>(null);
const exportDialogOpen = ref(false);
const exportDialogPhase = ref<ExportDialogPhase>('review');

/** Allow multi-line explanations on dense summary chips (default tooltip is single-line). */
const summaryTooltipUi = {
  content: 'h-auto max-w-xs px-2.5 py-1.5',
  text: 'whitespace-normal text-pretty',
};

const {
  ensureLoaded: ensureActivitiesLoaded,
  retry: retryActivitiesLoaded,
  stateFor: activitiesStateFor,
} = useRemoteActivities();

const {
  ensureLoaded: ensureRemoteLogsLoaded,
  retry: retryRemoteLogsLoaded,
  logsFor: remoteLogsStateFor,
  clientFor,
} = useRemoteDayLogs(date);

const {
  computedSeconds: roundedComputedSeconds,
  displayedInput: roundedDisplayedInput,
  setInput: setRoundedInput,
  commit: commitRoundedDuration,
  overrides: roundedOverrides,
  inputText: roundedInputText,
} = useRoundedDurations();

const {
  outcomes,
  progress: exportProgress,
  isRunning: exporting,
  completedCount: exportCompletedCount,
  totalCount: exportTotalCount,
  runExport,
  requestStop,
  retryTask,
} = useSyncExport({
  createTimeEntry: (config, input) => clientFor(config).createTimeEntry(input),
  finalizeExport: (body) =>
    $csrfFetch('/api/sync/export', {
      method: 'POST',
      body,
    }),
  onTaskFinalized: async (row) => {
    await retryRemoteLogs(row);
  },
  refresh: async () => {
    // Refresh is triggered on report close / retry completion, not mid-batch.
  },
});

function resetUiState() {
  activitySelections.value = {};
  localIssueRefs.value = {};
  expanded.value = {};
  dismissedDuplicates.value = {};
  exportComments.value = {};
  editingTitleTaskId.value = null;
  titleEditSnapshot.value = {};
  editingToSendTaskId.value = null;
  roundedOverrides.value = {};
  roundedInputText.value = {};
  exportDialogOpen.value = false;
  exportDialogPhase.value = 'review';
}

watch(date, () => {
  resetUiState();
});

function issueRefFor(row: RemoteSyncDayRowDto) {
  return localIssueRefs.value[row.taskId] ?? row.issueRef ?? null;
}

function selectedIdsFor(row: RemoteSyncDayRowDto): string[] {
  return row.entries.map((entry) => entry.id);
}

function selectedSecondsFor(row: RemoteSyncDayRowDto): number {
  return row.entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
}

function activityStatusFor(
  row: RemoteSyncDayRowDto,
): 'loading' | 'error' | 'empty' | 'available' | undefined {
  if (!issueRefFor(row) || !row.config) return undefined;
  const state = activitiesFor(row);
  if (state.loading || !state.loaded) return 'loading';
  if (state.errorKey) return 'error';
  if (state.options.length === 0) return 'empty';
  return 'available';
}

function stateFor(row: RemoteSyncDayRowDto): RemoteSyncRowState {
  return deriveRemoteSyncRowState({
    hasProject: !!row.projectName,
    hasTracker: !!row.config || !!row.trackerName,
    config: row.config ? { systemType: row.config.systemType } : null,
    hasIssueRef: !!issueRefFor(row),
    hasExports: row.exports.length > 0,
    activityStatus: activityStatusFor(row),
  });
}

function reasonKeyFor(row: RemoteSyncDayRowDto): string {
  const state = stateFor(row);
  switch (state) {
    case 'no_project':
      return t('remoteSync.state.noProject');
    case 'no_tracker':
      return t('remoteSync.state.noTracker');
    case 'system_not_implemented':
      return t('remoteSync.state.systemNotImplemented', { systemType: row.config?.systemType });
    case 'unlinked':
      return t('remoteSync.state.unlinked');
    case 'activity_loading':
      return t('remoteSync.state.activityLoading');
    case 'activity_error':
      return t('remoteSync.state.activityError');
    case 'no_activity':
      return t('remoteSync.state.noActivity');
    case 'sent':
      return t('remoteSync.state.sent');
    default:
      return t('remoteSync.state.manageable');
  }
}

/** Skip copy for the export dialog — includes exclusion/activity gaps, not only row state. */
function skipReasonFor(row: RemoteSyncDayRowDto): string {
  if (stateFor(row) !== 'manageable') {
    return reasonKeyFor(row);
  }
  if (isZeroDuration(row)) {
    return t('remoteSync.roundedDurationHint');
  }
  if (!selectedActivity(row)) {
    return t('remoteSync.activityEmptyOption');
  }
  return reasonKeyFor(row);
}

function stateBadgeColor(row: RemoteSyncDayRowDto): 'success' | 'warning' | 'error' | 'neutral' {
  switch (stateFor(row)) {
    case 'manageable':
    case 'sent':
      return 'success';
    case 'activity_loading':
      return 'neutral';
    case 'unlinked':
      return 'warning';
    case 'activity_error':
    case 'no_activity':
    case 'no_project':
    case 'no_tracker':
    case 'system_not_implemented':
      return 'error';
    default:
      return 'neutral';
  }
}

function kindLabelFor(row: RemoteSyncDayRowDto): string | null {
  const state = stateFor(row);
  if (state === 'unlinked') return null;
  if (state === 'manageable') return t('remoteSync.kind.ready');
  if (state === 'sent') return t('remoteSync.kind.sent');
  if (state === 'activity_loading') return t('remoteSync.kind.loading');
  return t('remoteSync.kind.blocked');
}

function canEditRow(row: RemoteSyncDayRowDto): boolean {
  return stateFor(row) === 'manageable';
}

function showEditorsFor(row: RemoteSyncDayRowDto): boolean {
  const state = stateFor(row);
  return state === 'manageable' || state === 'activity_loading';
}

function roundedSecondsFor(row: RemoteSyncDayRowDto): number {
  if (!row.config) return selectedSecondsFor(row);
  return roundedComputedSeconds(row.taskId, selectedSecondsFor(row), row.config.roundingRule);
}

function displayedRoundedInput(row: RemoteSyncDayRowDto): string {
  if (!row.config) return formatDuration(selectedSecondsFor(row));
  return roundedDisplayedInput(row.taskId, selectedSecondsFor(row), row.config.roundingRule);
}

function onRoundedInputChange(row: RemoteSyncDayRowDto, value: string | undefined) {
  setRoundedInput(row.taskId, value);
}

function commitRounded(row: RemoteSyncDayRowDto) {
  if (!row.config) return;
  commitRoundedDuration(row.taskId, selectedSecondsFor(row), row.config.roundingRule);
}

async function startEditToSend(row: RemoteSyncDayRowDto) {
  if (!canEditRow(row) || !row.config) return;
  editingToSendTaskId.value = row.taskId;
  await nextTick();
  const input = document.querySelector<HTMLInputElement>(
    `[data-testid="remote-sync-to-send-input-${row.taskId}"]`,
  );
  input?.focus();
  input?.select();
}

function commitEditToSend(row: RemoteSyncDayRowDto) {
  if (editingToSendTaskId.value !== row.taskId) return;
  commitRounded(row);
  editingToSendTaskId.value = null;
}

function cancelEditToSend(row: RemoteSyncDayRowDto) {
  if (editingToSendTaskId.value !== row.taskId) return;
  if (row.config) {
    setRoundedInput(
      row.taskId,
      formatDuration(
        roundedComputedSeconds(row.taskId, selectedSecondsFor(row), row.config.roundingRule),
      ),
    );
  }
  editingToSendTaskId.value = null;
}

function isZeroDuration(row: RemoteSyncDayRowDto): boolean {
  return roundedSecondsFor(row) === 0;
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      const remoteIssueId = issueRefFor(row)?.remoteIssueId;
      if (row.config && remoteIssueId) {
        const staticState = deriveRemoteSyncRowState({
          hasProject: !!row.projectName,
          hasTracker: true,
          config: { systemType: row.config.systemType },
          hasIssueRef: true,
        });
        if (staticState === 'manageable') {
          void ensureActivitiesLoaded(toPickerConfig(row.config), remoteIssueId);
        }
      }
    }
  },
  { immediate: true },
);

function activitiesFor(row: RemoteSyncDayRowDto) {
  return activitiesStateFor(row.config?.id, issueRefFor(row)?.remoteIssueId);
}

function selectedActivity(row: RemoteSyncDayRowDto): string | undefined {
  const explicit = activitySelections.value[row.taskId];
  if (explicit !== undefined) return explicit ?? undefined;
  const options = activitiesFor(row).options;
  const previous = row.exports[0]?.requiredFieldValues?.activity;
  if (previous && options.some((option) => option.id === previous)) return previous;
  return undefined;
}

function onActivityChange(row: RemoteSyncDayRowDto, value: string | null | undefined) {
  activitySelections.value = { ...activitySelections.value, [row.taskId]: value ?? null };
}

async function retryActivities(row: RemoteSyncDayRowDto) {
  const remoteIssueId = issueRefFor(row)?.remoteIssueId;
  if (!row.config || !remoteIssueId) return;
  await retryActivitiesLoaded(toPickerConfig(row.config), remoteIssueId);
}

watch(
  rows,
  (list) => {
    const byConfig = new Map<
      string,
      { config: RemoteSyncConfigSurfaceDto; issueIds: Set<string> }
    >();
    for (const row of list) {
      const issueId = issueRefFor(row)?.remoteIssueId;
      if (!row.config || !issueId || !isImplementedTrackerSystemType(row.config.systemType)) {
        continue;
      }
      const bucket = byConfig.get(row.config.id) ?? {
        config: row.config,
        issueIds: new Set<string>(),
      };
      bucket.issueIds.add(issueId);
      byConfig.set(row.config.id, bucket);
    }
    for (const bucket of byConfig.values()) {
      void ensureRemoteLogsLoaded(toPickerConfig(bucket.config), [...bucket.issueIds]);
    }
  },
  { immediate: true },
);

function remoteLogsFor(row: RemoteSyncDayRowDto) {
  return remoteLogsStateFor(row.config?.id, issueRefFor(row)?.remoteIssueId);
}

async function retryRemoteLogs(row: RemoteSyncDayRowDto) {
  if (!row.config) return;
  const issueIds = rows.value
    .filter((candidate) => candidate.config?.id === row.config?.id)
    .map((candidate) => issueRefFor(candidate)?.remoteIssueId)
    .filter((id): id is string => !!id);
  await retryRemoteLogsLoaded(toPickerConfig(row.config), [...new Set(issueIds)]);
}

async function linkRemoteIssue(
  row: RemoteSyncDayRowDto,
  payload: {
    remoteIssueId: string;
    cachedTitle: string;
    cachedRemoteProjectTitle?: string;
  },
) {
  const ids = row.entries.map((entry) => entry.id);
  if (ids.length === 0) return;
  try {
    // Day-scoped: move this date's entries onto the find-or-create linked task.
    await $csrfFetch('/api/time-entries/reassign', {
      method: 'POST',
      body: {
        ids,
        remoteIssueId: payload.remoteIssueId,
        cachedTitle: payload.cachedTitle,
        cachedRemoteProjectTitle: payload.cachedRemoteProjectTitle,
      },
    });
    // Refresh so the row key (taskId) and issue ref flip in place after the move.
    await refresh();
    if (row.config) {
      void ensureActivitiesLoaded(toPickerConfig(row.config), payload.remoteIssueId);
      void ensureRemoteLogsLoaded(toPickerConfig(row.config), [payload.remoteIssueId], true);
    }
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
  }
}

function isPushable(row: RemoteSyncDayRowDto): boolean {
  return stateFor(row) === 'manageable' && !isZeroDuration(row) && !!selectedActivity(row);
}

function pushableRows(): RemoteSyncDayRowDto[] {
  return rows.value.filter((row) => isPushable(row));
}

const dayTotalsSafe = computed(() =>
  computeRemoteSyncDayTotals(
    rows.value.map((row) => ({
      totalSeconds: row.totalSeconds,
      exportSeconds: isPushable(row) ? roundedSecondsFor(row) : 0,
      isPushable: isPushable(row),
      isSent: stateFor(row) === 'sent',
    })),
    untitledTotal.value,
  ),
);

function trackedSecondsFor(row: RemoteSyncDayRowDto): number {
  return selectedSecondsFor(row);
}

function lastExportDuration(row: RemoteSyncDayRowDto): number {
  let latest = row.exports[0];
  for (const record of row.exports) {
    if (!latest || record.createdAt > latest.createdAt) latest = record;
  }
  return latest?.exportDurationSeconds ?? 0;
}

function toSendSecondsFor(row: RemoteSyncDayRowDto): number {
  if (stateFor(row) === 'sent') {
    return lastExportDuration(row);
  }
  if (!showEditorsFor(row)) return 0;
  if (isZeroDuration(row)) return 0;
  return roundedSecondsFor(row);
}

function rowDeltaSeconds(row: RemoteSyncDayRowDto): number {
  return toSendSecondsFor(row) - trackedSecondsFor(row);
}

function duplicateLogFor(row: RemoteSyncDayRowDto) {
  const logsState = remoteLogsFor(row);
  if (!logsState.loaded || logsState.loading || logsState.errorKey) return null;
  if (!issueRefFor(row) || !row.config) return null;
  return findDuplicateRemoteLog(roundedSecondsFor(row), logsState.logs);
}

function ensureDefaultComment(row: RemoteSyncDayRowDto) {
  if (row.taskId in exportComments.value) return;
  const logs = remoteLogsFor(row).logs;
  exportComments.value = {
    ...exportComments.value,
    [row.taskId]: resolveDefaultExportComment(
      row.taskName,
      logs.map((log) => log.comment),
    ),
  };
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      ensureDefaultComment(row);
    }
  },
  { immediate: true },
);

// Re-apply default when remote logs first load and the user has not edited.
watch(
  () =>
    rows.value.map((row) => ({
      taskId: row.taskId,
      loaded: remoteLogsFor(row).loaded,
      comments: remoteLogsFor(row)
        .logs.map((log) => log.comment)
        .join('\0'),
    })),
  () => {
    for (const row of rows.value) {
      const logsState = remoteLogsFor(row);
      if (!logsState.loaded) continue;
      const current = exportComments.value[row.taskId];
      // Only fill when still at the bare task-name default (no user edit / no prior log default).
      if (current === undefined || current === row.taskName) {
        const next = resolveDefaultExportComment(
          row.taskName,
          logsState.logs.map((log) => log.comment),
        );
        if (next !== current) {
          exportComments.value = { ...exportComments.value, [row.taskId]: next };
        }
      }
    }
  },
  { deep: true },
);

function commentFor(row: RemoteSyncDayRowDto): string {
  ensureDefaultComment(row);
  return exportComments.value[row.taskId] ?? row.taskName;
}

function setComment(row: RemoteSyncDayRowDto, value: string | undefined) {
  exportComments.value = { ...exportComments.value, [row.taskId]: value ?? '' };
}

function activityLabelFor(row: RemoteSyncDayRowDto): string {
  const id = selectedActivity(row);
  const match = activitiesFor(row).options.find((option) => option.id === id);
  return match?.name ?? id ?? t('remoteSync.activityEmptyOption');
}

const exportIncludedRows = computed(() =>
  pushableRows().map((row) => {
    const issue = issueRefFor(row);
    return {
      taskId: row.taskId,
      taskName: row.taskName,
      issueLabel: issue
        ? `${issue.cachedTitle} (#${issue.remoteIssueId})`
        : t('remoteSync.emptyCell'),
      activityLabel: activityLabelFor(row),
      trackedSeconds: trackedSecondsFor(row),
      toSendSeconds: toSendSecondsFor(row),
      comment: resolveExportComment(commentFor(row), row.taskName),
      isRepeat: false,
      isDuplicate: !!duplicateLogFor(row),
      baseUrl: row.config?.baseUrl ?? null,
      row,
    };
  }),
);

const exportSkippedRows = computed(() =>
  rows.value
    .filter((row) => !isPushable(row))
    .map((row) => ({
      taskId: row.taskId,
      taskName: row.taskName,
      reason: skipReasonFor(row),
    })),
);

function openExportDialog() {
  if (pushableRows().length === 0) return;
  exportDialogPhase.value = 'review';
  exportDialogOpen.value = true;
}

async function confirmExportDialog() {
  const candidates = pushableRows();
  if (candidates.length === 0) return;
  exportDialogPhase.value = 'running';
  await runExport(
    candidates.map((row) => ({
      row,
      config: toPickerConfig(row.config!),
      remoteIssueId: issueRefFor(row)!.remoteIssueId,
      activityId: selectedActivity(row)!,
      durationSeconds: roundedSecondsFor(row),
      entryIds: selectedIdsFor(row),
      spentOn: date.value,
      comment: commentFor(row),
    })),
  );
  exportDialogPhase.value = 'report';
}

function cancelExportDialog() {
  if (exportDialogPhase.value === 'running') return;
  exportDialogOpen.value = false;
  exportDialogPhase.value = 'review';
}

async function closeExportDialog() {
  exportDialogOpen.value = false;
  exportDialogPhase.value = 'review';
  await refresh();
}

async function onExportRetry(taskId: string) {
  await retryTask(taskId);
}

function formatEntryStart(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: effective.value.timeZone,
  });
}

function formatEntryStop(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: effective.value.timeZone,
  });
}

function navigateToDate(iso: string) {
  if (iso === date.value) return;
  void router.push(`/sync/${iso}`);
}

function isExpanded(taskId: string): boolean {
  return !!expanded.value[taskId];
}

function toggleExpanded(taskId: string) {
  expanded.value = { ...expanded.value, [taskId]: !expanded.value[taskId] };
}

async function startEditTitle(row: RemoteSyncDayRowDto) {
  if (!canEditRow(row)) return;
  titleEditSnapshot.value = { ...titleEditSnapshot.value, [row.taskId]: commentFor(row) };
  editingTitleTaskId.value = row.taskId;
  await nextTick();
  const input = document.querySelector<HTMLInputElement>(
    `[data-testid="remote-sync-comment-${row.taskId}"]`,
  );
  input?.focus();
  input?.select();
}

function commitEditTitle(row: RemoteSyncDayRowDto) {
  if (editingTitleTaskId.value !== row.taskId) return;
  editingTitleTaskId.value = null;
}

function cancelEditTitle(row: RemoteSyncDayRowDto) {
  if (editingTitleTaskId.value !== row.taskId) return;
  const snapshot = titleEditSnapshot.value[row.taskId];
  if (snapshot !== undefined) {
    exportComments.value = { ...exportComments.value, [row.taskId]: snapshot };
  }
  editingTitleTaskId.value = null;
}
</script>

<template>
  <section class="grid gap-5" data-testid="remote-sync-page">
    <SyncDayHeader
      :date="date"
      :date-label="dayHeadingText"
      :export-label="exporting ? t('remoteSync.exporting') : t('remoteSync.exportButton')"
      :export-disabled="exporting || pushableRows().length === 0"
      @navigate="navigateToDate"
      @export="openExportDialog"
    />

    <div
      class="flex flex-wrap items-center gap-2"
      data-testid="remote-sync-summaries"
      aria-live="polite"
    >
      <UTooltip
        :text="t('remoteSync.dayTotalTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="neutral" variant="subtle" data-testid="remote-sync-total-day">
            {{ t('remoteSync.dayTotalLabel') }}: {{ formatDuration(dayTotalsSafe.dayTotal) }}
          </UBadge>
        </span>
      </UTooltip>
      <!-- keep legacy day-total hook for existing tests -->
      <span class="sr-only" data-testid="remote-sync-day-total">
        {{ t('remoteSync.dayTotal', { duration: formatDuration(dayTotalsSafe.dayTotal) }) }}
      </span>
      <UTooltip
        :text="t('remoteSync.trackedTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="primary" variant="subtle" data-testid="remote-sync-total-tracked">
            {{ t('remoteSync.trackedLabel') }}: {{ formatDuration(dayTotalsSafe.tracked) }}
          </UBadge>
        </span>
      </UTooltip>
      <UTooltip
        :text="t('remoteSync.toSendTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="success" variant="subtle" data-testid="remote-sync-total-to-send">
            {{ t('remoteSync.toSendLabel') }}: {{ formatDuration(dayTotalsSafe.toSend) }}
          </UBadge>
        </span>
      </UTooltip>
      <UTooltip
        :text="t('remoteSync.deltaTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="neutral" variant="outline" data-testid="remote-sync-total-delta">
            {{ t('remoteSync.deltaLabel') }}: {{ formatSignedDuration(dayTotalsSafe.delta) }}
          </UBadge>
        </span>
      </UTooltip>
      <UTooltip
        v-if="dayTotalsSafe.blocked > 0"
        :text="t('remoteSync.blockedTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="warning" variant="subtle" data-testid="remote-sync-total-blocked">
            {{ t('remoteSync.blockedLabel') }}: {{ formatDuration(dayTotalsSafe.blocked) }}
          </UBadge>
        </span>
      </UTooltip>
      <UTooltip
        v-if="dayTotalsSafe.sent > 0"
        :text="t('remoteSync.sentTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="neutral" variant="subtle" data-testid="remote-sync-total-sent">
            {{ t('remoteSync.sentLabel') }}: {{ formatDuration(dayTotalsSafe.sent) }}
          </UBadge>
        </span>
      </UTooltip>
      <UTooltip
        v-if="dayTotalsSafe.untitled > 0"
        :text="t('remoteSync.untitledTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="neutral" variant="subtle" data-testid="remote-sync-total-untitled">
            {{ t('remoteSync.untitledLabel') }}: {{ formatDuration(dayTotalsSafe.untitled) }}
          </UBadge>
        </span>
      </UTooltip>
    </div>

    <p v-if="isEmpty" class="text-muted" data-testid="remote-sync-empty-state">
      {{ t('remoteSync.emptyState') }}
    </p>

    <div v-else class="grid" data-testid="remote-sync-list">
      <SyncDayRow
        v-for="row in rows"
        :key="row.taskId"
        :row="row"
        :expanded="isExpanded(row.taskId)"
        :can-edit="canEditRow(row)"
        :show-editors="showEditorsFor(row)"
        :kind-label="kindLabelFor(row)"
        :kind-color="stateBadgeColor(row)"
        :reason="reasonKeyFor(row)"
        :issue-title="issueRefFor(row)?.cachedTitle ?? null"
        :issue-id="issueRefFor(row)?.remoteIssueId ?? null"
        :show-link-picker="stateFor(row) === 'unlinked' && !!row.config"
        :picker-config="row.config ? toPickerConfig(row.config) : null"
        :comment="commentFor(row)"
        :editing-title="editingTitleTaskId === row.taskId"
        :tracked-label="formatDuration(trackedSecondsFor(row))"
        :to-send-label="formatDuration(toSendSecondsFor(row))"
        :delta-label="formatSignedDuration(rowDeltaSeconds(row))"
        :editing-to-send="editingToSendTaskId === row.taskId"
        :to-send-input="displayedRoundedInput(row)"
        :activity-loading="stateFor(row) === 'activity_loading'"
        :activity-error="!!activitiesFor(row).errorKey"
        :activity-options="activitiesFor(row).options"
        :selected-activity-id="selectedActivity(row)"
        :no-activity="stateFor(row) === 'no_activity'"
        @toggle="toggleExpanded(row.taskId)"
        @link="(payload) => linkRemoteIssue(row, payload)"
        @edit-title="startEditTitle(row)"
        @update:comment="(value) => setComment(row, value)"
        @commit-title="commitEditTitle(row)"
        @cancel-title="cancelEditTitle(row)"
        @edit-to-send="startEditToSend(row)"
        @update:to-send="(value) => onRoundedInputChange(row, value)"
        @commit-to-send="commitEditToSend(row)"
        @cancel-to-send="cancelEditToSend(row)"
        @update:activity="(value) => onActivityChange(row, value)"
        @retry-activity="retryActivities(row)"
      >
        <template #detail>
          <SyncRowDetail
            :task-id="row.taskId"
            :entries="row.entries"
            :show-remote-logs="!!issueRefFor(row) && !!row.config"
            :remote-logs="remoteLogsFor(row).logs"
            :remote-logs-loading="remoteLogsFor(row).loading"
            :remote-logs-error-key="remoteLogsFor(row).errorKey"
            :remote-logs-loaded="remoteLogsFor(row).loaded"
            :duplicate-log="duplicateLogFor(row)"
            :duplicate-dismissed="!!dismissedDuplicates[row.taskId]"
            :format-entry-start="formatEntryStart"
            :format-entry-stop="formatEntryStop"
            @retry-remote-logs="retryRemoteLogs(row)"
            @dismiss-duplicate="
              dismissedDuplicates = { ...dismissedDuplicates, [row.taskId]: true }
            "
          />
        </template>
      </SyncDayRow>
      <div
        v-if="untitledTotal > 0"
        class="flex items-center justify-between border-b border-default py-1"
        data-testid="remote-sync-untitled-row"
      >
        <span class="font-semibold">{{ t('remoteSync.untitledBucketLabel') }}</span>
        <span class="font-mono text-sm tabular-nums" data-testid="remote-sync-untitled-duration">
          {{ formatDuration(untitledTotal) }}
        </span>
      </div>
    </div>

    <SyncExportDialog
      v-model:open="exportDialogOpen"
      :phase="exportDialogPhase"
      :included="exportIncludedRows"
      :skipped="exportSkippedRows"
      :day-total-seconds="dayTotalsSafe.dayTotal"
      :tracked-seconds="dayTotalsSafe.tracked"
      :to-send-seconds="dayTotalsSafe.toSend"
      :progress="exportProgress"
      :outcomes="outcomes"
      :completed-count="exportCompletedCount"
      :total-count="exportTotalCount"
      :is-running="exporting"
      @confirm="confirmExportDialog"
      @cancel="cancelExportDialog"
      @stop="requestStop"
      @close="closeExportDialog"
      @retry="onExportRetry"
    />
  </section>
</template>
