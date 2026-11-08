<script setup lang="ts">
import type {
  RemoteSyncConfigSurfaceDto,
  RemoteSyncDayDto,
  RemoteSyncDayRowDto,
  RemoteSyncRowState,
} from '~~/shared/types/remote-sync-day';
import type { TrackerDto } from '~~/shared/types/tracker';
import type { RemoteTimeLogDto } from '@osi/time-tracker-remote-trackers/contracts';
import { resolveDefaultExportComment, resolveExportComment } from '~~/shared/utils/export-comment';
import { computeInTrackerSummary } from '~~/shared/utils/compute-in-tracker-summary';
import type { ColumnDefinition } from '~/components/ColumnList.vue';
import type { SyncRowKind } from '~/components/sync/SyncDayRow.vue';
import type { ExportDialogIncludedRow } from '~/components/sync/SyncExportDialog.vue';
import type { ActivityByTask, ExportCommentsByTask, IssueRefByTask } from '~/types/sync-ui-maps';

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useProfile();
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
} = useAsyncData<RemoteSyncDayDto & { fetchedAt: number }>(
  () => `sync-day-${date.value}`,
  async () => ({
    ...(await requestFetch<RemoteSyncDayDto>('/api/sync/day', {
      query: { date: date.value },
    })),
    // When the server measured a running entry, so its part of the untitled bucket can be told
    // apart from the completed time there.
    fetchedAt: Date.now(),
  }),
  { watch: [date] },
);

const rows = computed(() => data.value?.rows ?? []);
const untitledTotal = computed(() => data.value?.untitledTotalSeconds ?? 0);
const isEmpty = computed(
  () => !pending.value && !fetchError.value && rows.value.length === 0 && untitledTotal.value === 0,
);

/**
 * The day in the Timer view's day-heading format (`formatDayHeading`, "sobota, 7 listopada 2026"),
 * a short form for phones, and the plain date the export review names ("7 listopada 2026").
 * SSR and hydration keep the ISO date so Node vs browser `toLocaleDateString` cannot mismatch;
 * format after mount.
 */
const dayLabels = ref({ long: date.value, short: date.value, plain: date.value });
function refreshDayLabels() {
  dayLabels.value = {
    long: formatDayHeading(date.value, locale.value),
    short: new Date(`${date.value}T12:00:00Z`).toLocaleDateString(locale.value, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    plain: formatDayHeading(date.value, locale.value, { weekday: false }),
  };
}
watch([date, locale], refreshDayLabels);
onMounted(refreshDayLabels);

// The running Time entry counts in the day total while it runs, as in the Timer view's total.
const { running, elapsedSeconds } = useTimer();
const runningInDay = computed(
  () =>
    !!running.value &&
    localDayKeyFromInstant(running.value.startedAt, effective.value.timeZone) === date.value,
);
// The running entry is not part of the loaded rows' completed time: reload once it stops or
// another one starts, so the rows and totals follow.
watch(
  () => running.value?.id ?? null,
  (id, previousId) => {
    if (id !== previousId) void refresh();
  },
);

/**
 * Completed untitled time. The server counts a running untitled entry into the bucket up to the
 * moment it answered; that part is taken back out, since the running time is shown live.
 */
const untitledCompleted = computed(() => {
  const entry = running.value;
  if (!entry || entry.taskId || !runningInDay.value || !data.value) return untitledTotal.value;
  const runningAtFetch = Math.floor((data.value.fetchedAt - Date.parse(entry.startedAt)) / 1000);
  return Math.max(0, untitledTotal.value - Math.max(0, runningAtFetch));
});
const runningSeconds = computed(() => (runningInDay.value ? elapsedSeconds.value : 0));

function toPickerConfig(config: RemoteSyncConfigSurfaceDto): TrackerDto {
  return {
    id: config.id,
    name: '',
    systemType: config.systemType,
    baseUrl: config.baseUrl,
    directBrowserAccess: config.directBrowserAccess,
    roundingRule: config.roundingRule,
    createdAt: '',
    updatedAt: '',
  };
}

// --- Local page orchestration state (parallel named task-keyed maps) ---
const activitySelections = ref<ActivityByTask>({});
const localIssueRefs = ref<IssueRefByTask>({});
const expanded = ref<Record<string, boolean>>({});
const exportComments = ref<ExportCommentsByTask>({});
const editingTitleTaskId = ref<string | null>(null);
const titleEditSnapshot = ref<Record<string, string>>({});
const editingToSendTaskId = ref<string | null>(null);
const exportDialogOpen = ref(false);
const reconciling = ref(false);

/** Narrow layout (D5): expand, state, text, durations, actions. */
const narrowColumns = '1.5rem 1.5rem minmax(0,1fr) 6rem 1.75rem';
const columns = computed(
  () =>
    [
      { key: 'expand', track: '1.5rem' },
      { key: 'state', track: '1.5rem', header: t('remoteSync.columns.state'), headerSrOnly: true },
      // Title, issue and activity share the flexible width, sized to what each holds at desktop
      // width: the activity column fits its "Wybierz czynność" select (160px) and no more, the
      // title (the row's own text) gets the largest share so it fits in both themes, and the
      // issue title gives way with an ellipsis (its number never truncates).
      { key: 'title', track: { fr: 1.65, min: '8rem' }, header: t('remoteSync.columns.title') },
      { key: 'issue', track: { fr: 1.1, min: '6rem' }, header: t('remoteSync.columns.issue') },
      {
        key: 'activity',
        track: { fr: 1, min: '10rem' },
        header: t('remoteSync.columns.activity'),
      },
      // The duration columns fit an HH:MM:SS value (the to-send frame hangs into the gap) and
      // their 12px headers, no wider, so the text columns keep the room.
      { key: 'tracked', track: '5rem', header: t('remoteSync.columns.tracked'), align: 'end' },
      { key: 'toSend', track: '5.5rem', header: t('remoteSync.columns.toSend'), align: 'end' },
      // One 28px action tile (the expanded block's reconcile action, REQ-505) plus the band's
      // 8px end inset, so the tile never sits flush on the inset's edge.
      { key: 'actions', track: '2.25rem' },
    ] satisfies ColumnDefinition[],
);

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
  progress: exportProgress,
  isRunning: exporting,
  completedCount: exportCompletedCount,
  totalCount: exportTotalCount,
  runExport,
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
});

function resetUiState() {
  activitySelections.value = {};
  localIssueRefs.value = {};
  expanded.value = {};
  exportComments.value = {};
  editingTitleTaskId.value = null;
  titleEditSnapshot.value = {};
  editingToSendTaskId.value = null;
  roundedOverrides.value = {};
  roundedInputText.value = {};
  exportDialogOpen.value = false;
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
      return awaitsActivity(row)
        ? t('remoteSync.state.needsActivity')
        : t('remoteSync.state.manageable');
  }
}

/**
 * A short read-only reason for a row that has no issue and cannot be linked, shown quietly in
 * its issue cell; the full reason stays on the state indicator (REQ-112, REQ-504).
 */
function issueReasonFor(row: RemoteSyncDayRowDto): string | null {
  switch (stateFor(row)) {
    case 'no_project':
      return t('remoteSync.shortReason.noProject');
    case 'no_tracker':
      return t(
        row.trackerName
          ? 'remoteSync.shortReason.noTracker'
          : 'remoteSync.shortReason.localProject',
      );
    case 'system_not_implemented':
      return t('remoteSync.shortReason.systemNotImplemented');
    default:
      return null;
  }
}

/**
 * Rows that are not exportable by design, with nothing to fix on this page: a local Project (no
 * Tracker at all), an unsupported system, or an issue whose tracker offers no activity.
 */
function isExcluded(row: RemoteSyncDayRowDto): boolean {
  const state = stateFor(row);
  return (
    state === 'system_not_implemented' ||
    state === 'no_activity' ||
    (state === 'no_tracker' && !row.trackerName)
  );
}

/**
 * The row's state indicator kind (REQ-504). A row the user can fix (no Project, a missing Tracker,
 * no issue, a failed load) is blocked, in amber; a deliberate exclusion is neutral.
 */
function stateKindFor(row: RemoteSyncDayRowDto): SyncRowKind {
  switch (stateFor(row)) {
    case 'manageable':
      return awaitsActivity(row) ? 'blocked' : 'ready';
    case 'sent':
      return 'sent';
    case 'activity_loading':
      return 'loading';
    default:
      return isExcluded(row) ? 'excluded' : 'blocked';
  }
}

function kindLabelFor(row: RemoteSyncDayRowDto): string | null {
  const state = stateFor(row);
  if (state === 'unlinked') return null;
  if (state === 'manageable' && !awaitsActivity(row)) return t('remoteSync.kind.ready');
  if (state === 'sent') return t('remoteSync.kind.sent');
  if (state === 'activity_loading') return t('remoteSync.kind.loading');
  return t(isExcluded(row) ? 'remoteSync.kind.excluded' : 'remoteSync.kind.blocked');
}

function canEditRow(row: RemoteSyncDayRowDto): boolean {
  return stateFor(row) === 'manageable';
}

/**
 * A Ready row with time to send but no activity chosen yet: a fixable gap, so its state icon is
 * the amber needs-attention kind, like a row without an issue.
 */
function awaitsActivity(row: RemoteSyncDayRowDto): boolean {
  return canEditRow(row) && !isZeroDuration(row) && !selectedActivity(row);
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
  return activitiesStateFor(row.config, issueRefFor(row)?.remoteIssueId);
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

/** `dayTotal` here is the completed time only; the running entry is added on top for display. */
const dayTotalsSafe = computed(() =>
  computeRemoteSyncDayTotals(
    rows.value.map((row) => ({
      totalSeconds: selectedSecondsFor(row),
      toSendSeconds: toSendSecondsFor(row),
      isSent: stateFor(row) === 'sent',
    })),
    untitledCompleted.value,
  ),
);

const inTrackerSummary = computed(() =>
  computeInTrackerSummary(
    rows.value
      .filter((row) => !!row.config && !!issueRefFor(row))
      .map((row) => {
        const state = remoteLogsFor(row);
        return {
          trackerId: row.config!.id,
          name: row.trackerName ?? row.config!.baseUrl,
          loading: state.loading,
          loaded: state.loaded,
          errorKey: state.errorKey,
          logs: state.logs,
        };
      }),
    dayTotalsSafe.value.toSend,
  ),
);

/**
 * Whether a Tracker (by its shown name, as the in-tracker summary names it) also failed to load
 * activities for one of the day's rows.
 */
function activitiesFailedFor(trackerName: string): boolean {
  return rows.value.some(
    (row) =>
      !!row.config &&
      (row.trackerName ?? row.config.baseUrl) === trackerName &&
      stateFor(row) === 'activity_error',
  );
}

/**
 * The failed Trackers grouped by reason, so the page alert states each reason once. The generic
 * fetch failure says "try again"; beside the alert's own retry button the page's wording says it
 * without the repetition, and names the activities too when they failed for the same Tracker.
 */
const inTrackerFailures = computed(() => {
  const summary = inTrackerSummary.value;
  if (summary.status !== 'unavailable') return [];
  const byReason = new Map<string, string[]>();
  for (const tracker of summary.trackers) {
    let messageKey = tracker.messageKey;
    if (messageKey === 'error.remoteTimeLogsFetchFailed') {
      messageKey = activitiesFailedFor(tracker.name)
        ? 'remoteSync.remoteLogsAndActivitiesError'
        : 'remoteSync.remoteLogsError';
    }
    byReason.set(messageKey, [...(byReason.get(messageKey) ?? []), tracker.name]);
  }
  return [...byReason].map(([messageKey, names]) => ({ messageKey, names: names.join(', ') }));
});

/**
 * Why Export is disabled, shown under it and in its tooltip: the Trackers cannot be reached (their
 * activities failed to load), the Ready rows with time still need an activity, or nothing is
 * ready. Null while exporting or when Export is available.
 */
const exportDisabledReason = computed(() => {
  if (exporting.value || pushableRows().length > 0) return null;
  if (rows.value.some((row) => stateFor(row) === 'activity_error')) {
    return t('remoteSync.exportTrackersUnreachable');
  }
  return t(
    rows.value.some(awaitsActivity)
      ? 'remoteSync.exportNeedsActivity'
      : 'remoteSync.exportNothingReady',
  );
});

/**
 * The alert's one retry: every failed remote log load and every failed activity load. A retried
 * activity scope turns to loading at once, so rows sharing it are retried only once.
 */
function retryFailedLoads() {
  for (const row of rows.value) {
    if (remoteLogsFor(row).errorKey) void retryRemoteLogs(row);
  }
  for (const row of rows.value) {
    if (activitiesFor(row).errorKey) void retryActivities(row);
  }
}

/** Ready rows whose to-send time waits for an activity, which the forecast still counts. */
const forecastAwaitsActivity = computed(() => rows.value.some(awaitsActivity));

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

const exportIncludedRows = computed(() =>
  pushableRows().map((row): ExportDialogIncludedRow => ({
    taskId: row.taskId,
    comment: resolveExportComment(commentFor(row), row.taskName),
    toSendSeconds: toSendSecondsFor(row),
    trackerName: row.trackerName ?? row.config?.baseUrl ?? null,
    issueId: issueRefFor(row)?.remoteIssueId ?? null,
    activityName:
      activitiesFor(row).options.find((option) => option.id === selectedActivity(row))?.name ??
      null,
  })),
);

/** The counted phrase for each reason a Task stays out of the export, in the order they are told. */
const EXCLUSION_I18N = {
  noActivityChosen: 'remoteSync.exportDialog.excluded.noActivityChosen',
  zeroDuration: 'remoteSync.exportDialog.excluded.zeroDuration',
  unlinked: 'remoteSync.exportDialog.excluded.unlinked',
  activityUnavailable: 'remoteSync.exportDialog.excluded.activityUnavailable',
  noProject: 'remoteSync.exportDialog.excluded.noProject',
  noTracker: 'remoteSync.exportDialog.excluded.noTracker',
  localProject: 'remoteSync.exportDialog.excluded.localProject',
  unsupported: 'remoteSync.exportDialog.excluded.unsupported',
  noActivityAvailable: 'remoteSync.exportDialog.excluded.noActivityAvailable',
} as const;
type ExclusionReason = keyof typeof EXCLUSION_I18N;

/** Why a Task of the day is neither in this export nor Sent; null when it is one of those. */
function exclusionReasonFor(row: RemoteSyncDayRowDto): ExclusionReason | null {
  switch (stateFor(row)) {
    case 'sent':
      return null;
    case 'manageable':
      if (isPushable(row)) return null;
      return isZeroDuration(row) ? 'zeroDuration' : 'noActivityChosen';
    case 'no_project':
      return 'noProject';
    case 'no_tracker':
      return row.trackerName ? 'noTracker' : 'localProject';
    case 'system_not_implemented':
      return 'unsupported';
    case 'unlinked':
      return 'unlinked';
    case 'no_activity':
      return 'noActivityAvailable';
    default:
      return 'activityUnavailable';
  }
}

/**
 * The review's one line about the Tasks left out (REQ-229), counted by reason without listing
 * them: "3 bez czynności, 1 projekt lokalny, 1 bez zgłoszenia". Empty when none is left out.
 */
const exportExcludedSummary = computed(() => {
  const counts = new Map<ExclusionReason, number>();
  for (const row of rows.value) {
    const reason = exclusionReasonFor(row);
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  // SAFETY: EXCLUSION_I18N is a literal object, so its keys are exactly ExclusionReason.
  return (Object.keys(EXCLUSION_I18N) as ExclusionReason[])
    .flatMap((reason) => {
      const count = counts.get(reason);
      // Each counted phrase stays on one line ("1 z projektu lokalnego"); lines break only
      // between phrases.
      return count ? [t(EXCLUSION_I18N[reason], { count }, count).replaceAll(' ', ' ')] : [];
    })
    .join(', ');
});

const exportIncludedTotalSeconds = computed(() =>
  exportIncludedRows.value.reduce((sum, row) => sum + row.toSendSeconds, 0),
);

function openExportDialog() {
  if (pushableRows().length === 0) return;
  exportDialogOpen.value = true;
}

async function confirmExportDialog() {
  const candidates = pushableRows();
  if (candidates.length === 0) return;
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
  await refresh();
  exportDialogOpen.value = false;
  const allSucceeded = candidates.every((row) => exportProgress.value[row.taskId] === 'done');
  if (allSucceeded) {
    toast.success(t('remoteSync.exportSuccessToast'));
  } else {
    toast.warning(t('remoteSync.exportWarningToast'));
  }
}

function cancelExportDialog() {
  if (exporting.value) return;
  exportDialogOpen.value = false;
}

async function linkDiscoveredEntry(row: RemoteSyncDayRowDto, log: RemoteTimeLogDto) {
  if (!row.config) return;
  const accepted = await confirm({
    title: t('remoteSync.linkConfirmTitle'),
    description: t('remoteSync.linkConfirmMessage', {
      duration: formatDuration(log.durationSeconds),
      comment: log.comment?.trim() || t('remoteSync.remoteLogNoComment'),
      task: row.taskName,
      count: row.entries.length,
    }),
    confirmLabel: t('remoteSync.linkRemoteEntry'),
    cancelLabel: t('remoteSync.exportDialog.cancel'),
  });
  if (!accepted) return;
  reconciling.value = true;
  try {
    await $csrfFetch('/api/sync/link', {
      method: 'POST',
      body: {
        taskId: row.taskId,
        trackerId: row.config.id,
        localDate: date.value,
        spentOn: log.spentOn,
        remoteIssueId: log.remoteIssueId,
        remoteLogId: log.remoteLogId,
        exportDurationSeconds: log.durationSeconds,
        requiredFieldValues: log.activityId ? { activity: log.activityId } : {},
      },
    });
    await refresh();
    await retryRemoteLogs(row);
    toast.success(t('remoteSync.linkSuccessToast'));
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
  } finally {
    reconciling.value = false;
  }
}

async function deleteLinkedEntry(
  row: RemoteSyncDayRowDto,
  log: RemoteTimeLogDto,
  exportId: string,
) {
  const config = row.config;
  if (!config) return;
  await confirm({
    title: t('remoteSync.deleteConfirmTitle'),
    description: t('remoteSync.deleteConfirmMessage', {
      id: log.remoteLogId,
      duration: formatDuration(log.durationSeconds),
      issue: issueRefFor(row)?.remoteIssueId ?? log.remoteIssueId,
    }),
    confirmLabel: t('remoteSync.deleteRemoteEntry'),
    cancelLabel: t('remoteSync.exportDialog.cancel'),
    confirmColor: 'error',
    onConfirm: async () => {
      reconciling.value = true;
      try {
        const outcome = await clientFor(toPickerConfig(config)).deleteTimeEntry(log.remoteLogId);
        if (outcome.status === 'deleted' || outcome.status === 'not_found') {
          await $csrfFetch('/api/sync/export', {
            method: 'DELETE',
            body: { exportId },
          });
          await refresh();
          await retryRemoteLogs(row);
          toast.success(t('remoteSync.deleteSuccessToast'));
          return;
        }
        toast.error(t(outcome.messageKey));
      } catch (err) {
        toast.error(t(extractCaughtMessageKey(err, 'errors.unexpected')));
      } finally {
        reconciling.value = false;
      }
    },
  });
}

/** Entry clock times in 24-hour `HH:MM`, like the Timer, in the user's timezone. */
function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
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
  <section class="grid gap-6" data-testid="remote-sync-page">
    <SyncDayHeader
      :date="date"
      :date-label="dayLabels.long"
      :date-label-short="dayLabels.short"
      :export-label="exporting ? t('remoteSync.exporting') : t('remoteSync.exportButton')"
      :export-disabled="exporting || pushableRows().length === 0"
      :export-disabled-reason="exportDisabledReason"
      :export-open="exportDialogOpen"
      @navigate="navigateToDate"
      @export="openExportDialog"
    />

    <!-- Two equal stat cards across the content width, stacked on phones. -->
    <div class="grid gap-4 sm:grid-cols-2" data-testid="remote-sync-summaries" aria-live="polite">
      <StatCard
        :label="t('remoteSync.dayTotalLabel')"
        icon="i-lucide-clock"
        data-testid="remote-sync-total-day"
      >
        {{ formatDuration(dayTotalsSafe.dayTotal + runningSeconds) }}
        <template #caption>
          <!-- While a Time entry runs, the total (like the Timer's) includes it: the caption splits
               it into the completed part, which the rows add up to, and the running part, in the
               in-tracker card's "value word + value word" form. -->
          <span v-if="runningInDay" data-testid="remote-sync-total-day-parts">
            <span class="tabular-nums">
              {{ formatDuration(dayTotalsSafe.dayTotal) }}
            </span>
            {{ t('remoteSync.dayTotalCompleted') }}
            <span class="me-1 text-dimmed">+</span>
            <span class="tabular-nums">
              {{ formatDuration(runningSeconds) }}
            </span>
            {{ t('remoteSync.dayTotalRunning') }}
          </span>
          <template v-else>{{ t('remoteSync.dayTotalHint') }}</template>
        </template>
      </StatCard>
      <StatCard
        :label="t('remoteSync.inTrackerLabel')"
        icon="i-lucide-cloud-upload"
        data-testid="remote-sync-total-in-tracker"
      >
        <!-- No number yet (or none to trust): a dimmed duration-shaped placeholder keeps the
             figure's width and weight, so the card does not read as broken. -->
        <template v-if="inTrackerSummary.status === 'loading'">
          <span class="text-dimmed">{{ t('remoteSync.unknownDuration') }}</span>
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin text-dimmed"
            aria-hidden="true"
          />
        </template>
        <span v-else-if="inTrackerSummary.status === 'unavailable'" class="text-dimmed">
          {{ t('remoteSync.unknownDuration') }}
        </span>
        <template v-else>{{ formatDuration(inTrackerSummary.totalSeconds) }}</template>
        <template #caption>
          <span
            v-if="inTrackerSummary.status === 'loading'"
            role="status"
            data-testid="remote-sync-total-in-tracker-loading"
          >
            {{ t('remoteSync.inTrackerLoading') }}
          </span>
          <!-- The card keeps its one-line rhythm; the named failures are the alert below. -->
          <span v-else-if="inTrackerSummary.status === 'unavailable'">
            {{ t('remoteSync.inTrackerUnavailable') }}
          </span>
          <!-- One line at desktop width, value before its word: "03:00:00 w trackerach +
               06:00:00 do wysłania (w tym bez czynności)". The figures are caption text (sans,
               tabular, 400, the caption's colour), never heavier than the words around them;
               the "+" joins them quietly. -->
          <span v-else data-testid="remote-sync-total-in-tracker-parts">
            <span class="tabular-nums">
              {{ formatDuration(inTrackerSummary.logsSeconds) }}
            </span>
            {{ t('remoteSync.inTrackersLogs') }}
            <!-- The space after "+" is a margin: the template drops whitespace between tags. -->
            <span class="me-1 text-dimmed">+</span>
            <span class="tabular-nums">
              {{ formatDuration(inTrackerSummary.toSendSeconds) }}
            </span>
            {{ t('remoteSync.inTrackerToSend') }}
            <!-- A forecast: the to-send part still counts Ready time whose activity is not
                 chosen yet, and says so. -->
            <template v-if="forecastAwaitsActivity">
              {{ t('remoteSync.inTrackerAwaitingActivity') }}
            </template>
          </span>
        </template>
      </StatCard>
    </div>

    <!-- REQ-510: why the in-tracker total is missing, told once for the page: the failed
         Trackers grouped by reason, and one retry for all of them. -->
    <UAlert
      v-if="inTrackerSummary.status === 'unavailable'"
      color="warning"
      variant="subtle"
      icon="i-lucide-unplug"
      orientation="horizontal"
      role="alert"
      :ui="{ root: 'py-3', description: 'grid gap-0.5 opacity-100' }"
      data-testid="remote-sync-total-in-tracker-unavailable"
    >
      <template #description>
        <p v-for="failure in inTrackerFailures" :key="failure.messageKey" class="m-0">
          <span class="font-medium">{{ failure.names }}:</span>
          {{ t(failure.messageKey) }}
        </p>
      </template>
      <template v-if="inTrackerSummary.trackers.some((tracker) => tracker.retryable)" #actions>
        <!-- The page's one retry style: a neutral outline control (the rows use its icon-only
             tile). It reloads every failed load, remote time entries and activities. -->
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :label="t('remoteSync.retryLoading')"
          data-testid="remote-sync-retry-failed"
          @click="retryFailedLoads"
        />
      </template>
    </UAlert>

    <p v-if="isEmpty" class="text-muted" data-testid="remote-sync-empty-state">
      {{ t('remoteSync.emptyState') }}
    </p>

    <ColumnList v-else :columns="columns" :narrow="narrowColumns" data-testid="remote-sync-list">
      <SyncDayRow
        v-for="row in rows"
        :key="row.taskId"
        :columns="columns"
        :row="row"
        :expanded="isExpanded(row.taskId)"
        :can-edit="canEditRow(row)"
        :show-editors="showEditorsFor(row)"
        :kind-label="kindLabelFor(row)"
        :kind="stateKindFor(row)"
        :reason="reasonKeyFor(row)"
        :issue-title="issueRefFor(row)?.cachedTitle ?? null"
        :issue-id="issueRefFor(row)?.remoteIssueId ?? null"
        :issue-reason="issueReasonFor(row)"
        :show-link-picker="stateFor(row) === 'unlinked' && !!row.config"
        :picker-config="row.config ? toPickerConfig(row.config) : null"
        :picker-scope="
          row.remoteProjectId && row.remoteProjectTitle
            ? { remoteProjectId: row.remoteProjectId, remoteProjectTitle: row.remoteProjectTitle }
            : null
        "
        :day-label="dayLabels.plain"
        :comment="commentFor(row)"
        :editing-title="editingTitleTaskId === row.taskId"
        :tracked-label="formatDuration(trackedSecondsFor(row))"
        :to-send-label="formatDuration(toSendSecondsFor(row))"
        :delta-label="formatSignedDuration(rowDeltaSeconds(row))"
        :editing-to-send="editingToSendTaskId === row.taskId"
        :to-send-input="displayedRoundedInput(row)"
        :activity-loading="stateFor(row) === 'activity_loading'"
        :activity-error="!!activitiesFor(row).errorKey"
        :activity-error-key="activitiesFor(row).errorKey"
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
            :columns="columns"
            :task-id="row.taskId"
            :entries="row.entries"
            :export-records="row.exports"
            :tracker-id="row.config?.id ?? null"
            :tracker-destination="
              row.config ? { provider: row.config.systemType, baseUrl: row.config.baseUrl } : null
            "
            :show-remote-logs="!!issueRefFor(row) && !!row.config"
            :remote-logs="remoteLogsFor(row).logs"
            :remote-logs-loading="remoteLogsFor(row).loading"
            :remote-logs-error-key="remoteLogsFor(row).errorKey"
            :remote-logs-loaded="remoteLogsFor(row).loaded"
            :can-reconcile="!!issueRefFor(row) && !!row.config"
            :busy="reconciling"
            :format-entry-start="formatEntryTime"
            :format-entry-stop="formatEntryTime"
            @retry-remote-logs="retryRemoteLogs(row)"
            @link="(log) => linkDiscoveredEntry(row, log)"
            @delete="(log, exportId) => deleteLinkedEntry(row, log, exportId)"
          />
        </template>
      </SyncDayRow>
      <ColumnRow v-if="untitledTotal > 0" data-testid="remote-sync-untitled-row">
        <ColumnCell
          :columns="columns"
          col="title"
          :narrow="{ col: [3, 4], row: 1 }"
          class="truncate text-sm font-medium text-muted"
        >
          {{ t('remoteSync.untitledBucketLabel') }}
        </ColumnCell>
        <ColumnCell
          :columns="columns"
          col="tracked"
          :narrow="{ col: [4, 5], row: 1 }"
          align="end"
          class="font-mono text-sm tabular-nums text-muted"
          data-testid="remote-sync-untitled-duration"
        >
          {{ formatDuration(untitledCompleted) }}
        </ColumnCell>
      </ColumnRow>
    </ColumnList>

    <SyncExportDialog
      v-model:open="exportDialogOpen"
      :date-label="dayLabels.plain"
      :included="exportIncludedRows"
      :to-send-seconds="exportIncludedTotalSeconds"
      :excluded-summary="exportExcludedSummary"
      :completed-count="exportCompletedCount"
      :total-count="exportTotalCount"
      :is-running="exporting"
      @confirm="confirmExportDialog"
      @cancel="cancelExportDialog"
    />
  </section>
</template>
