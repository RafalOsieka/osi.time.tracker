<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TableColumn } from '@nuxt/ui';
import {
  deriveRemoteSyncRowState,
  isImplementedRemoteSystemType,
} from '~~/shared/utils/remote-sync-row-state';
import { computeRemoteSyncDayTotals } from '~~/shared/utils/remote-sync-day-totals';
import { findDuplicateRemoteLog } from '~~/shared/utils/find-duplicate-remote-log';
import type {
  RemoteSyncConfigSurfaceDto,
  RemoteSyncDayDto,
  RemoteSyncDayRowDto,
  RemoteSyncRowState,
} from '~~/shared/types/remote-sync-day';
import type { RemoteSystemConfigDto } from '~~/shared/types/remote-system-config';
import { formatDuration, formatSignedDuration } from '~/utils/formatDuration';
import { useRemoteActivities } from '~/composables/useRemoteActivities';
import { useRemoteDayLogs } from '~/composables/useRemoteDayLogs';
import { useRoundedDurations } from '~/composables/useRoundedDurations';
import { useSyncExport } from '~/composables/useSyncExport';
import { resolveDefaultExportComment, resolveExportComment } from '~~/shared/utils/export-comment';
import { extractMessageKey } from '~/utils/extractMessageKey';

type ExportDialogPhase = 'review' | 'running' | 'report';

type SyncTableRow =
  | { kind: 'task'; task: RemoteSyncDayRowDto; blockedGroup: boolean }
  | { kind: 'untitled'; totalSeconds: number };

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
 * Locale-aware day heading. Computed only on the client so Node vs browser
 * `toLocaleDateString` ICU differences cannot hydrate-mismatch the page.
 */
const dayHeadingText = ref(date.value);
function refreshDayHeading() {
  dayHeadingText.value = new Date(`${date.value}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: effective.value.timeZone,
  });
}
if (import.meta.client) {
  watch([date, locale, () => effective.value.timeZone], refreshDayHeading, { immediate: true });
}

function toPickerConfig(config: RemoteSyncConfigSurfaceDto): RemoteSystemConfigDto {
  return {
    id: config.id,
    clientId: '',
    systemType: config.systemType,
    baseUrl: config.baseUrl,
    executionMode: config.executionMode,
    roundingRule: config.roundingRule,
    requiredFieldDefaults: config.requiredFieldDefaults,
    createdAt: '',
    updatedAt: '',
  };
}

// --- Local page orchestration state ---
const activitySelections = ref<Record<string, string | null>>({});
const localIssueRefs = ref<Record<string, { remoteIssueId: string; cachedTitle: string }>>({});
const selectedEntryIds = ref<Record<string, string[]>>({});
const expanded = ref<true | Record<string, boolean>>({});
const dismissedDuplicates = ref<Record<string, boolean>>({});
const exportComments = ref<Record<string, string>>({});
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
  applyOverride: applyRoundedOverride,
  reset: resetRoundedDuration,
  hasOverride: hasRoundedOverride,
  suggestionsFor: roundingSuggestionsForTask,
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

watch(date, () => {
  activitySelections.value = {};
  localIssueRefs.value = {};
  selectedEntryIds.value = {};
  expanded.value = {};
  dismissedDuplicates.value = {};
  exportComments.value = {};
  editingToSendTaskId.value = null;
  roundedOverrides.value = {};
  roundedInputText.value = {};
  exportDialogOpen.value = false;
  exportDialogPhase.value = 'review';
});

function issueRefFor(row: RemoteSyncDayRowDto) {
  return localIssueRefs.value[row.taskId] ?? row.issueRef ?? null;
}

function ensureDefaultSelection(row: RemoteSyncDayRowDto) {
  if (!(row.taskId in selectedEntryIds.value)) {
    selectedEntryIds.value = {
      ...selectedEntryIds.value,
      [row.taskId]: row.entries.map((entry) => entry.id),
    };
  }
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      ensureDefaultSelection(row);
    }
  },
  { immediate: true },
);

function selectedIdsFor(row: RemoteSyncDayRowDto): string[] {
  ensureDefaultSelection(row);
  return selectedEntryIds.value[row.taskId] ?? [];
}

function toggleEntry(row: RemoteSyncDayRowDto, entryId: string, checked: boolean) {
  const current = new Set(selectedIdsFor(row));
  if (checked) current.add(entryId);
  else current.delete(entryId);
  selectedEntryIds.value = { ...selectedEntryIds.value, [row.taskId]: [...current] };
}

function selectAllEntries(row: RemoteSyncDayRowDto) {
  selectedEntryIds.value = {
    ...selectedEntryIds.value,
    [row.taskId]: row.entries.map((entry) => entry.id),
  };
}

function deselectAllEntries(row: RemoteSyncDayRowDto) {
  selectedEntryIds.value = { ...selectedEntryIds.value, [row.taskId]: [] };
}

function selectedSecondsFor(row: RemoteSyncDayRowDto): number {
  const selected = new Set(selectedIdsFor(row));
  return row.entries
    .filter((entry) => selected.has(entry.id))
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);
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
    hasClient: !!row.clientName,
    config: row.config ? { systemType: row.config.systemType } : null,
    hasIssueRef: !!issueRefFor(row),
    activityStatus: activityStatusFor(row),
  });
}

function reasonKeyFor(row: RemoteSyncDayRowDto): string {
  const state = stateFor(row);
  switch (state) {
    case 'no_client':
      return t('remoteSync.state.noClient');
    case 'no_config':
      return t('remoteSync.state.noConfig');
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
    default:
      return t('remoteSync.state.manageable');
  }
}

/** Skip copy for the export dialog — includes exclusion/activity gaps, not only row state. */
function skipReasonFor(row: RemoteSyncDayRowDto): string {
  if (stateFor(row) !== 'manageable') {
    return reasonKeyFor(row);
  }
  const exclusion = excludedReason(row);
  if (exclusion === 'none') {
    return t('remoteSync.excludedNoSelection');
  }
  if (exclusion === 'zero') {
    return t('remoteSync.roundedDurationHint');
  }
  if (!selectedActivity(row)) {
    return t('remoteSync.activityEmptyOption');
  }
  return reasonKeyFor(row);
}

function stateIconFor(row: RemoteSyncDayRowDto): string {
  switch (stateFor(row)) {
    case 'no_client':
      return 'i-lucide-user-x';
    case 'no_config':
      return 'i-lucide-settings';
    case 'system_not_implemented':
      return 'i-lucide-ban';
    case 'unlinked':
      return 'i-lucide-link-2-off';
    case 'activity_loading':
      return 'i-lucide-loader-circle';
    case 'activity_error':
      return 'i-lucide-triangle-alert';
    case 'no_activity':
      return 'i-lucide-circle-off';
    default:
      return 'i-lucide-check';
  }
}

function stateBadgeColor(row: RemoteSyncDayRowDto): 'success' | 'warning' | 'error' | 'neutral' {
  switch (stateFor(row)) {
    case 'manageable':
      return 'success';
    case 'activity_loading':
    case 'unlinked':
      return 'warning';
    case 'activity_error':
    case 'no_activity':
    case 'no_client':
    case 'no_config':
    case 'system_not_implemented':
      return 'error';
    default:
      return 'neutral';
  }
}

function canManageEntries(row: RemoteSyncDayRowDto): boolean {
  const state = stateFor(row);
  return state === 'manageable' || state === 'activity_loading';
}

function isActionableRow(row: RemoteSyncDayRowDto): boolean {
  const state = stateFor(row);
  return (
    state === 'manageable' ||
    state === 'activity_loading' ||
    state === 'activity_error' ||
    state === 'no_activity' ||
    state === 'unlinked'
  );
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

function resetRounded(row: RemoteSyncDayRowDto) {
  resetRoundedDuration(row.taskId);
}

async function startEditToSend(row: RemoteSyncDayRowDto) {
  if (!canManageEntries(row) || !row.config) return;
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

function roundingSuggestionsFor(row: RemoteSyncDayRowDto) {
  if (!row.config) return [];
  return roundingSuggestionsForTask(row.taskId, selectedSecondsFor(row), row.config.roundingRule);
}

function applyRoundingSuggestion(row: RemoteSyncDayRowDto, seconds: number) {
  applyRoundedOverride(row.taskId, seconds);
}

function isExcluded(row: RemoteSyncDayRowDto): boolean {
  return selectedIdsFor(row).length === 0 || roundedSecondsFor(row) === 0;
}

function excludedReason(row: RemoteSyncDayRowDto): 'none' | 'zero' | null {
  if (!isExcluded(row)) return null;
  return selectedIdsFor(row).length === 0 ? 'none' : 'zero';
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      const remoteIssueId = issueRefFor(row)?.remoteIssueId;
      if (row.config && remoteIssueId) {
        const staticState = deriveRemoteSyncRowState({
          hasProject: !!row.projectName,
          hasClient: !!row.clientName,
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
  const defaultId = row.config?.requiredFieldDefaults?.activity;
  const match = defaultId ? options.find((option) => option.id === defaultId) : undefined;
  return match ? match.id : undefined;
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
      if (!row.config || !issueId || !isImplementedRemoteSystemType(row.config.systemType)) {
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
  payload: { remoteIssueId: string; cachedTitle: string },
) {
  try {
    await $csrfFetch(`/api/tasks/${row.taskId}/remote-issue-ref`, {
      method: 'POST',
      body: payload,
    });
    localIssueRefs.value = { ...localIssueRefs.value, [row.taskId]: payload };
    if (row.config) {
      void ensureActivitiesLoaded(toPickerConfig(row.config), payload.remoteIssueId);
      void ensureRemoteLogsLoaded(toPickerConfig(row.config), [payload.remoteIssueId], true);
    }
  } catch (err: unknown) {
    toast.error(t(extractMessageKey(err, 'errors.unexpected')));
  }
}

function isPushable(row: RemoteSyncDayRowDto): boolean {
  return stateFor(row) === 'manageable' && !isExcluded(row) && !!selectedActivity(row);
}

function pushableRows(): RemoteSyncDayRowDto[] {
  return rows.value.filter((row) => isPushable(row));
}

function exportableRows(): RemoteSyncDayRowDto[] {
  return rows.value.filter((row) => canManageEntries(row) || stateFor(row) === 'manageable');
}

function includeAllTasks() {
  const next = { ...selectedEntryIds.value };
  for (const row of rows.value) {
    if (!canManageEntries(row) && stateFor(row) !== 'manageable') continue;
    next[row.taskId] = row.entries.map((entry) => entry.id);
  }
  selectedEntryIds.value = next;
}

function excludeAllTasks() {
  const next = { ...selectedEntryIds.value };
  for (const row of rows.value) {
    if (!canManageEntries(row) && stateFor(row) !== 'manageable') continue;
    next[row.taskId] = [];
  }
  selectedEntryIds.value = next;
}

function toggleRowInclusion(row: RemoteSyncDayRowDto, checked: boolean) {
  if (!canManageEntries(row) && stateFor(row) !== 'manageable') return;
  if (checked) selectAllEntries(row);
  else deselectAllEntries(row);
}

function inclusionModel(row: RemoteSyncDayRowDto): boolean | 'indeterminate' {
  const selected = selectedIdsFor(row);
  if (selected.length === 0) return false;
  if (selected.length === row.entries.length) return true;
  return 'indeterminate';
}

const dayTotalsSafe = computed(() =>
  computeRemoteSyncDayTotals(
    rows.value.map((row) => {
      const selected = selectedSecondsFor(row);
      const pushable = isPushable(row);
      const included =
        selectedIdsFor(row).length > 0 && !(canManageEntries(row) && roundedSecondsFor(row) === 0);
      return {
        totalSeconds: row.totalSeconds,
        selectedSeconds: selected,
        exportSeconds: pushable ? roundedSecondsFor(row) : 0,
        isPushable: pushable,
        isIncluded: included,
      };
    }),
    untitledTotal.value,
  ),
);

function trackedSecondsFor(row: RemoteSyncDayRowDto): number {
  return selectedSecondsFor(row);
}

function toSendSecondsFor(row: RemoteSyncDayRowDto): number {
  if (!canManageEntries(row) && stateFor(row) !== 'manageable') return 0;
  if (isExcluded(row)) return 0;
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

function isRepeatRow(row: RemoteSyncDayRowDto): boolean {
  return selectedIdsFor(row).some(
    (id) => row.entries.find((entry) => entry.id === id)?.previouslyExported,
  );
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
      isRepeat: isRepeatRow(row),
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

function navigateToDate(iso: string) {
  if (iso === date.value) return;
  void router.push(`/sync/${iso}`);
}

const timeZone = computed(() => effective.value.timeZone);

const tableRows = computed<SyncTableRow[]>(() => {
  const actionable: SyncTableRow[] = [];
  const blocked: SyncTableRow[] = [];
  for (const task of rows.value) {
    if (isActionableRow(task)) {
      actionable.push({ kind: 'task', task, blockedGroup: false });
    } else {
      blocked.push({ kind: 'task', task, blockedGroup: true });
    }
  }
  const result = [...actionable, ...blocked];
  if (untitledTotal.value > 0) {
    result.push({ kind: 'untitled', totalSeconds: untitledTotal.value });
  }
  return result;
});

function rowId(row: SyncTableRow): string {
  return row.kind === 'task' ? row.task.taskId : 'untitled';
}

/** Narrow a table row to its task payload (template event handlers lose the discriminant). */
function taskOf(row: SyncTableRow): RemoteSyncDayRowDto {
  if (row.kind !== 'task') {
    throw new Error('Expected a task row');
  }
  return row.task;
}

function isExpanded(taskId: string): boolean {
  if (expanded.value === true) return true;
  if (!expanded.value || typeof expanded.value !== 'object') return false;
  return !!expanded.value[taskId];
}

function toggleExpanded(taskId: string) {
  if (expanded.value === true) {
    expanded.value = { [taskId]: false };
    return;
  }
  const current = { ...(expanded.value as Record<string, boolean>) };
  current[taskId] = !current[taskId];
  expanded.value = current;
}

const columns = computed<TableColumn<SyncTableRow>[]>(() => [
  { id: 'expand', header: '' },
  { id: 'include', header: t('remoteSync.columnInclude') },
  { id: 'task', header: t('remoteSync.columnTask') },
  { id: 'issue', header: t('remoteSync.columnIssue') },
  { id: 'activity', header: t('remoteSync.columnActivity') },
  { id: 'duration', header: t('remoteSync.columnDuration') },
  { id: 'state', header: t('remoteSync.columnState') },
]);
</script>

<template>
  <section class="grid gap-5" data-testid="remote-sync-page">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <SyncDayHeader
        :date="date"
        :time-zone="timeZone"
        :heading="dayHeadingText"
        @navigate="navigateToDate"
      />
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          variant="ghost"
          size="sm"
          :label="t('remoteSync.includeAllTasks')"
          data-testid="remote-sync-include-all"
          :disabled="exportableRows().length === 0"
          @click="includeAllTasks"
        />
        <UButton
          variant="ghost"
          size="sm"
          :label="t('remoteSync.excludeAllTasks')"
          data-testid="remote-sync-exclude-all"
          :disabled="exportableRows().length === 0"
          @click="excludeAllTasks"
        />
        <UButton
          :label="exporting ? t('remoteSync.exporting') : t('remoteSync.exportButton')"
          :disabled="exporting || pushableRows().length === 0"
          data-testid="remote-sync-export-button"
          @click="openExportDialog"
        />
      </div>
    </div>

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
        v-if="dayTotalsSafe.excluded > 0"
        :text="t('remoteSync.excludedTooltip')"
        :content="{ side: 'bottom' }"
        :ui="summaryTooltipUi"
      >
        <span tabindex="0" class="inline-flex">
          <UBadge color="neutral" variant="subtle" data-testid="remote-sync-total-excluded">
            {{ t('remoteSync.excludedLabel') }}: {{ formatDuration(dayTotalsSafe.excluded) }}
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

    <UTable
      v-else
      v-model:expanded="expanded"
      :data="tableRows"
      :columns="columns"
      :loading="pending"
      :get-row-id="rowId"
      :expanded-options="{
        getRowCanExpand: (tableRow) => tableRow.original.kind === 'task',
      }"
      data-testid="remote-sync-table"
      class="w-full"
    >
      <template #expand-cell="{ row: tableRow }">
        <UButton
          v-if="tableRow.original.kind === 'task'"
          :icon="
            isExpanded(taskOf(tableRow.original).taskId)
              ? 'i-lucide-chevron-down'
              : 'i-lucide-chevron-right'
          "
          variant="ghost"
          square
          size="xs"
          :aria-expanded="isExpanded(taskOf(tableRow.original).taskId)"
          :aria-controls="`remote-sync-detail-${taskOf(tableRow.original).taskId}`"
          :aria-label="
            isExpanded(taskOf(tableRow.original).taskId)
              ? t('remoteSync.collapseRow')
              : t('remoteSync.expandRow')
          "
          :data-testid="`remote-sync-expand-${taskOf(tableRow.original).taskId}`"
          @click="toggleExpanded(taskOf(tableRow.original).taskId)"
        />
      </template>

      <template #include-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <UCheckbox
            :model-value="inclusionModel(taskOf(tableRow.original))"
            :disabled="
              !canManageEntries(taskOf(tableRow.original)) &&
              stateFor(taskOf(tableRow.original)) !== 'manageable'
            "
            :aria-label="t('remoteSync.columnInclude')"
            :data-testid="`remote-sync-include-${taskOf(tableRow.original).taskId}`"
            @update:model-value="
              (checked: boolean | 'indeterminate') =>
                toggleRowInclusion(taskOf(tableRow.original), checked === true)
            "
          />
        </template>
      </template>

      <template #task-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <span
            class="font-semibold"
            :data-testid="`remote-sync-row-${taskOf(tableRow.original).taskId}`"
          >
            <span :data-testid="`remote-sync-task-name-${taskOf(tableRow.original).taskId}`">
              {{ taskOf(tableRow.original).taskName }}
            </span>
          </span>
        </template>
        <template v-else>
          <span class="font-semibold" data-testid="remote-sync-untitled-row">
            {{ t('remoteSync.untitledBucketLabel') }}
          </span>
        </template>
      </template>

      <template #issue-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <span
            v-if="issueRefFor(taskOf(tableRow.original))"
            class="text-sm"
            :data-testid="`remote-sync-issue-${taskOf(tableRow.original).taskId}`"
          >
            {{ issueRefFor(taskOf(tableRow.original))?.cachedTitle }}
            <span class="text-muted">
              (#{{ issueRefFor(taskOf(tableRow.original))?.remoteIssueId }})
            </span>
          </span>
          <RemoteIssuePicker
            v-else-if="
              stateFor(taskOf(tableRow.original)) === 'unlinked' && taskOf(tableRow.original).config
            "
            :config="toPickerConfig(taskOf(tableRow.original).config!)"
            :data-testid="`remote-sync-link-${taskOf(tableRow.original).taskId}`"
            @link="(payload) => linkRemoteIssue(taskOf(tableRow.original), payload)"
          />
          <span v-else class="text-muted">{{ t('remoteSync.emptyCell') }}</span>
        </template>
      </template>

      <template #activity-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <div
            v-if="
              stateFor(taskOf(tableRow.original)) === 'manageable' ||
              stateFor(taskOf(tableRow.original)) === 'activity_loading' ||
              stateFor(taskOf(tableRow.original)) === 'activity_error' ||
              stateFor(taskOf(tableRow.original)) === 'no_activity'
            "
            class="flex min-w-40 flex-wrap items-center gap-2"
          >
            <span
              v-if="
                activitiesFor(taskOf(tableRow.original)).loading ||
                !activitiesFor(taskOf(tableRow.original)).loaded
              "
              role="status"
              aria-live="polite"
              :data-testid="`remote-sync-activity-loading-${taskOf(tableRow.original).taskId}`"
            >
              {{ t('remoteSync.activityLoading') }}
            </span>
            <template v-else-if="activitiesFor(taskOf(tableRow.original)).errorKey">
              <span
                role="alert"
                :data-testid="`remote-sync-activity-error-${taskOf(tableRow.original).taskId}`"
              >
                {{ t('remoteSync.activityFetchError') }}
              </span>
              <UButton
                variant="ghost"
                size="xs"
                :label="t('remoteSync.activityRetry')"
                :data-testid="`remote-sync-activity-retry-${taskOf(tableRow.original).taskId}`"
                @click="retryActivities(taskOf(tableRow.original))"
              />
            </template>
            <span
              v-else-if="stateFor(taskOf(tableRow.original)) === 'no_activity'"
              role="status"
              :data-testid="`remote-sync-no-activity-${taskOf(tableRow.original).taskId}`"
            >
              {{ t('remoteSync.noActivityReason') }}
            </span>
            <USelect
              v-else
              :id="`remote-sync-activity-${taskOf(tableRow.original).taskId}`"
              :model-value="selectedActivity(taskOf(tableRow.original))"
              :items="activitiesFor(taskOf(tableRow.original)).options"
              label-key="name"
              value-key="id"
              :placeholder="t('remoteSync.activityEmptyOption')"
              :aria-label="t('remoteSync.activityLabel')"
              :data-testid="`remote-sync-activity-select-${taskOf(tableRow.original).taskId}`"
              @update:model-value="
                (value: string | undefined) => onActivityChange(taskOf(tableRow.original), value)
              "
            />
          </div>
          <span v-else class="text-muted">{{ t('remoteSync.emptyCell') }}</span>
        </template>
      </template>

      <template #duration-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <div
            class="flex flex-wrap items-center gap-1 font-mono text-sm"
            :data-testid="`remote-sync-row-duration-${taskOf(tableRow.original).taskId}`"
          >
            <span :data-testid="`remote-sync-tracked-${taskOf(tableRow.original).taskId}`">
              {{ formatDuration(trackedSecondsFor(taskOf(tableRow.original))) }}
            </span>
            <span aria-hidden="true">{{ t('remoteSync.trackedToSendArrow') }}</span>
            <template v-if="canManageEntries(taskOf(tableRow.original))">
              <UInput
                v-if="editingToSendTaskId === taskOf(tableRow.original).taskId"
                :id="`remote-sync-to-send-${taskOf(tableRow.original).taskId}`"
                :model-value="displayedRoundedInput(taskOf(tableRow.original))"
                size="sm"
                class="w-24 font-mono"
                :aria-label="t('remoteSync.roundedDurationLabel')"
                :data-testid="`remote-sync-to-send-input-${taskOf(tableRow.original).taskId}`"
                @update:model-value="
                  (value: string | undefined) =>
                    onRoundedInputChange(taskOf(tableRow.original), value)
                "
                @blur="commitEditToSend(taskOf(tableRow.original))"
                @keydown.enter.prevent="commitEditToSend(taskOf(tableRow.original))"
                @keydown.esc.prevent="cancelEditToSend(taskOf(tableRow.original))"
              />
              <UButton
                v-else
                variant="link"
                color="neutral"
                size="sm"
                class="h-auto min-h-0 px-0 py-0 font-mono text-sm font-normal"
                :label="formatDuration(toSendSecondsFor(taskOf(tableRow.original)))"
                :aria-label="t('remoteSync.editToSend')"
                :data-testid="`remote-sync-to-send-${taskOf(tableRow.original).taskId}`"
                @click="startEditToSend(taskOf(tableRow.original))"
              />
            </template>
            <span
              v-else
              :data-testid="`remote-sync-to-send-${taskOf(tableRow.original).taskId}`"
            >
              {{ formatDuration(toSendSecondsFor(taskOf(tableRow.original))) }}
            </span>
            <span
              class="text-muted"
              :data-testid="`remote-sync-row-delta-${taskOf(tableRow.original).taskId}`"
            >
              ({{ formatSignedDuration(rowDeltaSeconds(taskOf(tableRow.original))) }})
            </span>
          </div>
        </template>
        <template v-else>
          <span class="font-mono text-sm" data-testid="remote-sync-untitled-duration">
            {{ formatDuration(tableRow.original.totalSeconds) }}
          </span>
        </template>
      </template>

      <template #state-cell="{ row: tableRow }">
        <template v-if="tableRow.original.kind === 'task'">
          <UBadge
            :color="stateBadgeColor(taskOf(tableRow.original))"
            variant="subtle"
            :icon="stateIconFor(taskOf(tableRow.original))"
            :data-testid="`remote-sync-state-${taskOf(tableRow.original).taskId}`"
          >
            {{ reasonKeyFor(taskOf(tableRow.original)) }}
          </UBadge>
        </template>
      </template>

      <template #expanded="{ row: tableRow }">
        <SyncRowDetail
          v-if="tableRow.original.kind === 'task'"
          :row="taskOf(tableRow.original)"
          :entries="taskOf(tableRow.original).entries"
          :can-manage-entries="canManageEntries(taskOf(tableRow.original))"
          :selected-entry-ids="selectedIdsFor(taskOf(tableRow.original))"
          :tracked-seconds="trackedSecondsFor(taskOf(tableRow.original))"
          :to-send-seconds="toSendSecondsFor(taskOf(tableRow.original))"
          :delta-seconds="rowDeltaSeconds(taskOf(tableRow.original))"
          :rounded-input="displayedRoundedInput(taskOf(tableRow.original))"
          :has-override="hasRoundedOverride(taskOf(tableRow.original).taskId)"
          :is-excluded="isExcluded(taskOf(tableRow.original))"
          :excluded-reason="excludedReason(taskOf(tableRow.original))"
          :rounding-suggestions="roundingSuggestionsFor(taskOf(tableRow.original))"
          :show-remote-logs="
            !!issueRefFor(taskOf(tableRow.original)) && !!taskOf(tableRow.original).config
          "
          :remote-logs="remoteLogsFor(taskOf(tableRow.original)).logs"
          :remote-logs-loading="remoteLogsFor(taskOf(tableRow.original)).loading"
          :remote-logs-error-key="remoteLogsFor(taskOf(tableRow.original)).errorKey"
          :remote-logs-loaded="remoteLogsFor(taskOf(tableRow.original)).loaded"
          :duplicate-log="duplicateLogFor(taskOf(tableRow.original))"
          :duplicate-dismissed="!!dismissedDuplicates[taskOf(tableRow.original).taskId]"
          :comment="commentFor(taskOf(tableRow.original))"
          :format-entry-start="formatEntryStart"
          @toggle-entry="
            (entryId, checked) => toggleEntry(taskOf(tableRow.original), entryId, checked)
          "
          @select-all-entries="selectAllEntries(taskOf(tableRow.original))"
          @deselect-all-entries="deselectAllEntries(taskOf(tableRow.original))"
          @rounded-input="(value) => onRoundedInputChange(taskOf(tableRow.original), value)"
          @commit-rounded="commitRounded(taskOf(tableRow.original))"
          @reset-rounded="resetRounded(taskOf(tableRow.original))"
          @apply-suggestion="
            (seconds) => applyRoundingSuggestion(taskOf(tableRow.original), seconds)
          "
          @retry-remote-logs="retryRemoteLogs(taskOf(tableRow.original))"
          @dismiss-duplicate="
            dismissedDuplicates = {
              ...dismissedDuplicates,
              [taskOf(tableRow.original).taskId]: true,
            }
          "
          @comment-input="(value) => setComment(taskOf(tableRow.original), value)"
        />
      </template>
    </UTable>

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
