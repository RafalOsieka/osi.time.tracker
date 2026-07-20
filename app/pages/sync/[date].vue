<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { applyRoundingRule } from '~~/shared/utils/rounding';
import {
  deriveRemoteSyncRowState,
  isImplementedRemoteSystemType,
} from '~~/shared/utils/remote-sync-row-state';
import type {
  RemoteSyncConfigSurfaceDto,
  RemoteSyncDayDto,
  RemoteSyncDayRowDto,
  RemoteSyncRowState,
} from '~~/shared/types/remote-sync-day';
import type {
  FinalizeRemoteExportResultDto,
  RemoteExportTaskOutcomeDto,
  RemoteTimeLogDto,
} from '~~/shared/types/remote-export';
import type { RemoteSystemConfigDto } from '~~/shared/types/remote-system-config';
import type { RemoteFieldOption } from '~~/shared/types/remote-field-option';
import { formatDuration } from '~/utils/formatDuration';
import { normalizeDurationInput } from '~/utils/normalizeDurationInput';
import { useRemoteActivities } from '~/composables/useRemoteActivities';
import { mapRemoteSyncClientError, useRemoteSyncClient } from '~/composables/useRemoteSyncClient';
import { extractMessageKey } from '~/utils/extractMessageKey';

const route = useRoute();
const { t, locale } = useI18n();
const toast = useToast();
const confirm = useConfirm();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();

const date = computed(() => String(route.params.date));

const {
  data,
  pending,
  error: fetchError,
  refresh,
} = useAsyncData<RemoteSyncDayDto>(
  () => `sync-day-${date.value}`,
  () => $fetch<RemoteSyncDayDto>('/api/sync/day', { query: { date: date.value } }),
  { watch: [date] },
);

const rows = computed(() => data.value?.rows ?? []);
const untitledTotal = computed(() => data.value?.untitledTotalSeconds ?? 0);
const totalSeconds = computed(
  () => rows.value.reduce((sum, row) => sum + row.totalSeconds, 0) + untitledTotal.value,
);
const isEmpty = computed(
  () => !pending.value && !fetchError.value && rows.value.length === 0 && untitledTotal.value === 0,
);

function dayHeading(): string {
  return new Date(`${date.value}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: effective.value.timeZone,
  });
}

// --- Local, page-only state ---
const roundedOverrides = ref<Record<string, number>>({});
const activitySelections = ref<Record<string, string | null>>({});
const localIssueRefs = ref<Record<string, { remoteIssueId: string; cachedTitle: string }>>({});
const selectedEntryIds = ref<Record<string, string[]>>({});
const outcomes = ref<Record<string, RemoteExportTaskOutcomeDto>>({});
const exporting = ref(false);

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

function isEntrySelected(row: RemoteSyncDayRowDto, entryId: string): boolean {
  return selectedIdsFor(row).includes(entryId);
}

function toggleEntry(row: RemoteSyncDayRowDto, entryId: string, checked: boolean) {
  const current = new Set(selectedIdsFor(row));
  if (checked) current.add(entryId);
  else current.delete(entryId);
  selectedEntryIds.value = { ...selectedEntryIds.value, [row.taskId]: [...current] };
}

function selectedSecondsFor(row: RemoteSyncDayRowDto): number {
  const selected = new Set(selectedIdsFor(row));
  return row.entries
    .filter((entry) => selected.has(entry.id))
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);
}

// --- Activities ---
interface ActivitiesState {
  options: RemoteFieldOption[];
  loading: boolean;
  errorKey: string | null;
  loaded: boolean;
}

const activitiesByScopeKey = ref<Record<string, ActivitiesState>>({});
const activitiesInFlight = new Map<string, Promise<void>>();

function activitiesScopeKeyFor(row: RemoteSyncDayRowDto): string | null {
  const remoteIssueId = issueRefFor(row)?.remoteIssueId;
  if (!row.config || !remoteIssueId) return null;
  return `${row.config.id}:${remoteIssueId}`;
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

function roundedSecondsFor(row: RemoteSyncDayRowDto): number {
  if (row.taskId in roundedOverrides.value) {
    return roundedOverrides.value[row.taskId]!;
  }
  return applyRoundingRule(selectedSecondsFor(row), row.config!.roundingRule);
}

function roundedInputFor(row: RemoteSyncDayRowDto): string {
  return formatDuration(roundedSecondsFor(row));
}

const roundedInputText = ref<Record<string, string>>({});

function displayedRoundedInput(row: RemoteSyncDayRowDto): string {
  return roundedInputText.value[row.taskId] ?? roundedInputFor(row);
}

function onRoundedInputChange(row: RemoteSyncDayRowDto, value: string | undefined) {
  roundedInputText.value = { ...roundedInputText.value, [row.taskId]: value ?? '' };
}

function commitRounded(row: RemoteSyncDayRowDto) {
  const raw = displayedRoundedInput(row);
  const seconds = normalizeDurationInput(raw);
  if (seconds === null) {
    roundedInputText.value = { ...roundedInputText.value, [row.taskId]: roundedInputFor(row) };
    return;
  }
  roundedOverrides.value = { ...roundedOverrides.value, [row.taskId]: seconds };
  roundedInputText.value = { ...roundedInputText.value, [row.taskId]: formatDuration(seconds) };
}

function resetRounded(row: RemoteSyncDayRowDto) {
  roundedOverrides.value = Object.fromEntries(
    Object.entries(roundedOverrides.value).filter(([taskId]) => taskId !== row.taskId),
  );
  roundedInputText.value = Object.fromEntries(
    Object.entries(roundedInputText.value).filter(([taskId]) => taskId !== row.taskId),
  );
}

function isExcluded(row: RemoteSyncDayRowDto): boolean {
  return selectedIdsFor(row).length === 0 || roundedSecondsFor(row) === 0;
}

async function ensureActivitiesLoaded(
  config: RemoteSyncConfigSurfaceDto,
  remoteIssueId: string,
  scopeKey: string,
  force = false,
) {
  if (!force && activitiesByScopeKey.value[scopeKey]?.loaded) return;
  if (!force) {
    const inflight = activitiesInFlight.get(scopeKey);
    if (inflight) {
      await inflight;
      return;
    }
  }

  const run = (async () => {
    activitiesByScopeKey.value = {
      ...activitiesByScopeKey.value,
      [scopeKey]: { options: [], loading: true, errorKey: null, loaded: false },
    };
    const { fetchOptions, options, errorKey } = useRemoteActivities(toPickerConfig(config));
    await fetchOptions(remoteIssueId);
    activitiesByScopeKey.value = {
      ...activitiesByScopeKey.value,
      [scopeKey]: {
        options: options.value,
        loading: false,
        errorKey: errorKey.value,
        loaded: true,
      },
    };
  })();

  activitiesInFlight.set(scopeKey, run);
  try {
    await run;
  } finally {
    activitiesInFlight.delete(scopeKey);
  }
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      const remoteIssueId = issueRefFor(row)?.remoteIssueId;
      const scopeKey = activitiesScopeKeyFor(row);
      if (row.config && remoteIssueId && scopeKey) {
        const staticState = deriveRemoteSyncRowState({
          hasProject: !!row.projectName,
          hasClient: !!row.clientName,
          config: { systemType: row.config.systemType },
          hasIssueRef: true,
        });
        if (staticState === 'manageable') {
          void ensureActivitiesLoaded(row.config, remoteIssueId, scopeKey);
        }
      }
    }
  },
  { immediate: true },
);

function activitiesFor(row: RemoteSyncDayRowDto): ActivitiesState {
  const scopeKey = activitiesScopeKeyFor(row);
  return (
    (scopeKey ? activitiesByScopeKey.value[scopeKey] : undefined) ?? {
      options: [],
      loading: false,
      errorKey: null,
      loaded: false,
    }
  );
}

function selectedActivity(row: RemoteSyncDayRowDto): string | null {
  const explicit = activitySelections.value[row.taskId];
  if (explicit !== undefined) return explicit;
  const options = activitiesFor(row).options;
  const previous = row.exports[0]?.requiredFieldValues?.activity;
  if (previous && options.some((option) => option.id === previous)) return previous;
  const defaultId = row.config?.requiredFieldDefaults?.activity;
  const match = defaultId ? options.find((option) => option.id === defaultId) : undefined;
  return match ? match.id : null;
}

function onActivityChange(row: RemoteSyncDayRowDto, value: string | null) {
  activitySelections.value = { ...activitySelections.value, [row.taskId]: value };
}

async function retryActivities(row: RemoteSyncDayRowDto) {
  const remoteIssueId = issueRefFor(row)?.remoteIssueId;
  const scopeKey = activitiesScopeKeyFor(row);
  if (!row.config || !remoteIssueId || !scopeKey) return;
  await ensureActivitiesLoaded(row.config, remoteIssueId, scopeKey, true);
}

// --- Remote log context ---
interface RemoteLogsState {
  logs: RemoteTimeLogDto[];
  loading: boolean;
  errorKey: string | null;
  loaded: boolean;
}

const remoteLogsByConfig = ref<Record<string, RemoteLogsState>>({});
const clientByConfigId = new Map<string, ReturnType<typeof useRemoteSyncClient>>();

function clientFor(config: RemoteSyncConfigSurfaceDto) {
  let client = clientByConfigId.get(config.id);
  if (!client) {
    client = useRemoteSyncClient(toPickerConfig(config));
    clientByConfigId.set(config.id, client);
  }
  return client;
}

function remoteLogsKey(configId: string, spentOn: string, workPackageIds: string[]): string {
  return `${configId}:${spentOn}:${[...workPackageIds].sort().join(',')}`;
}

async function ensureRemoteLogsLoaded(
  config: RemoteSyncConfigSurfaceDto,
  workPackageIds: string[],
  force = false,
) {
  const key = remoteLogsKey(config.id, date.value, workPackageIds);
  if (!force && remoteLogsByConfig.value[key]?.loaded) return;
  remoteLogsByConfig.value = {
    ...remoteLogsByConfig.value,
    [key]: { logs: [], loading: true, errorKey: null, loaded: false },
  };
  try {
    const logs = await clientFor(config).fetchTimeLogs({
      spentOn: date.value,
      workPackageIds,
    });
    remoteLogsByConfig.value = {
      ...remoteLogsByConfig.value,
      [key]: { logs, loading: false, errorKey: null, loaded: true },
    };
  } catch (err: unknown) {
    remoteLogsByConfig.value = {
      ...remoteLogsByConfig.value,
      [key]: {
        logs: [],
        loading: false,
        errorKey: mapRemoteSyncClientError(err, 'error.remoteTimeLogsFetchFailed'),
        loaded: true,
      },
    };
  }
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
      void ensureRemoteLogsLoaded(bucket.config, [...bucket.issueIds]);
    }
  },
  { immediate: true },
);

function remoteLogsFor(row: RemoteSyncDayRowDto): RemoteLogsState {
  const issueId = issueRefFor(row)?.remoteIssueId;
  if (!row.config || !issueId) {
    return { logs: [], loading: false, errorKey: null, loaded: false };
  }
  // Logs are fetched per config+all issues; filter to this issue for display.
  const matchingKeys = Object.keys(remoteLogsByConfig.value).filter((key) =>
    key.startsWith(`${row.config!.id}:${date.value}:`),
  );
  const states = matchingKeys.map((key) => remoteLogsByConfig.value[key]!);
  if (states.some((state) => state.loading)) {
    return { logs: [], loading: true, errorKey: null, loaded: false };
  }
  const errorState = states.find((state) => state.errorKey);
  if (errorState) {
    return {
      logs: [],
      loading: false,
      errorKey: errorState.errorKey,
      loaded: true,
    };
  }
  const logs = states.flatMap((state) => state.logs).filter((log) => log.remoteIssueId === issueId);
  return { logs, loading: false, errorKey: null, loaded: states.length > 0 };
}

async function retryRemoteLogs(row: RemoteSyncDayRowDto) {
  if (!row.config) return;
  const issueIds = rows.value
    .filter((candidate) => candidate.config?.id === row.config?.id)
    .map((candidate) => issueRefFor(candidate)?.remoteIssueId)
    .filter((id): id is string => !!id);
  clientFor(row.config).invalidateCaches();
  await ensureRemoteLogsLoaded(row.config, [...new Set(issueIds)], true);
}

// --- Inline linking ---
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
      const scopeKey = `${row.config.id}:${payload.remoteIssueId}`;
      void ensureActivitiesLoaded(row.config, payload.remoteIssueId, scopeKey);
      void ensureRemoteLogsLoaded(row.config, [payload.remoteIssueId], true);
    }
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: t(extractMessageKey(err, 'errors.unexpected')),
      life: 4000,
    });
  }
}

// --- Export orchestration ---
function isPushable(row: RemoteSyncDayRowDto): boolean {
  return stateFor(row) === 'manageable' && !isExcluded(row) && !!selectedActivity(row);
}

function pushableRows(): RemoteSyncDayRowDto[] {
  return rows.value.filter((row) => isPushable(row));
}

async function runExport(rowsToExport: RemoteSyncDayRowDto[]) {
  exporting.value = true;
  const nextOutcomes = { ...outcomes.value };

  for (const row of rowsToExport) {
    const activityId = selectedActivity(row);
    const issueRef = issueRefFor(row);
    if (!row.config || !activityId || !issueRef) {
      nextOutcomes[row.taskId] = {
        taskId: row.taskId,
        status: 'excluded',
        messageKey: 'remoteSync.outcomeExcluded',
      };
      continue;
    }

    let remoteLogId: string | undefined;
    try {
      const created = await clientFor(row.config).createTimeEntry({
        remoteIssueId: issueRef.remoteIssueId,
        spentOn: date.value,
        durationSeconds: roundedSecondsFor(row),
        activityId,
        // OpenProject stores the free-text note on the time log as `comment`.
        comment: row.taskName,
      });
      remoteLogId = created.remoteLogId;
    } catch (err: unknown) {
      nextOutcomes[row.taskId] = {
        taskId: row.taskId,
        status: 'remote_failure',
        messageKey: mapRemoteSyncClientError(err, 'remoteSync.outcomeRemoteFailure'),
      };
      continue;
    }

    try {
      const finalized = await $csrfFetch<FinalizeRemoteExportResultDto>('/api/sync/export', {
        method: 'POST',
        body: {
          taskId: row.taskId,
          localDate: date.value,
          remoteIssueId: issueRef.remoteIssueId,
          remoteLogId,
          exportDurationSeconds: roundedSecondsFor(row),
          requiredFieldValues: { activity: activityId },
          entryIds: selectedIdsFor(row),
        },
      });
      nextOutcomes[row.taskId] = {
        taskId: row.taskId,
        status: 'success',
        remoteLogId: finalized.remoteLogId,
        exportId: finalized.exportId,
        messageKey: 'remoteSync.outcomeSuccess',
        messageParams: { remoteLogId: finalized.remoteLogId },
      };
      await retryRemoteLogs(row);
    } catch {
      nextOutcomes[row.taskId] = {
        taskId: row.taskId,
        status: 'uncertain_finalization',
        remoteLogId,
        messageKey: 'remoteSync.outcomeUncertain',
      };
      await retryRemoteLogs(row);
    }
  }

  outcomes.value = nextOutcomes;
  exporting.value = false;
  await refresh();
}

function startExport() {
  const candidates = pushableRows();
  if (candidates.length === 0) return;

  const repeatTasks = candidates.filter((row) =>
    selectedIdsFor(row).some(
      (id) => row.entries.find((entry) => entry.id === id)?.previouslyExported,
    ),
  );

  if (repeatTasks.length > 0) {
    confirm.require({
      header: t('remoteSync.repeatConfirmHeader'),
      message: t('remoteSync.repeatConfirmMessage', {
        tasks: repeatTasks.map((row) => row.taskName).join(', '),
      }),
      acceptLabel: t('remoteSync.repeatConfirmAccept'),
      rejectLabel: t('remoteSync.repeatConfirmReject'),
      accept: () => {
        void runExport(candidates);
      },
    });
    return;
  }

  void runExport(candidates);
}

function outcomeText(row: RemoteSyncDayRowDto): string | null {
  const outcome = outcomes.value[row.taskId];
  if (!outcome?.messageKey) return null;
  return t(outcome.messageKey, outcome.messageParams ?? {});
}

function formatEntryStart(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: effective.value.timeZone,
  });
}
</script>

<template>
  <section class="remote-sync" data-testid="remote-sync-page">
    <div class="remote-sync__header">
      <div>
        <h2 class="remote-sync__title" data-testid="remote-sync-heading">
          {{ t('remoteSync.pageTitle', { date: dayHeading() }) }}
        </h2>
        <p class="remote-sync__total" data-testid="remote-sync-day-total">
          {{ t('remoteSync.dayTotal', { duration: formatDuration(totalSeconds) }) }}
        </p>
      </div>
      <Button
        :label="exporting ? t('remoteSync.exporting') : t('remoteSync.exportButton')"
        :disabled="exporting || pushableRows().length === 0"
        data-testid="remote-sync-export-button"
        @click="startExport"
      />
    </div>

    <p v-if="isEmpty" class="remote-sync__empty" data-testid="remote-sync-empty-state">
      {{ t('remoteSync.emptyState') }}
    </p>

    <div v-else class="remote-sync__rows" role="list">
      <div
        v-for="row in rows"
        :key="row.taskId"
        class="remote-sync__row"
        role="listitem"
        :data-testid="`remote-sync-row-${row.taskId}`"
      >
        <div class="remote-sync__row-header">
          <span class="remote-sync__task-name" :data-testid="`remote-sync-task-name-${row.taskId}`">
            {{ row.taskName }}
          </span>
          <span class="remote-sync__state" :data-testid="`remote-sync-state-${row.taskId}`">
            {{ reasonKeyFor(row) }}
          </span>
        </div>

        <div class="remote-sync__durations">
          <span :data-testid="`remote-sync-original-duration-${row.taskId}`">
            {{ t('remoteSync.originalDurationLabel') }}: {{ formatDuration(row.totalSeconds) }}
          </span>

          <template v-if="stateFor(row) === 'manageable' || stateFor(row) === 'activity_loading'">
            <span :data-testid="`remote-sync-selected-duration-${row.taskId}`">
              {{ t('remoteSync.selectedDurationLabel') }}:
              {{ formatDuration(selectedSecondsFor(row)) }}
            </span>
            <label :for="`remote-sync-rounded-${row.taskId}`" class="remote-sync__field-label">
              {{ t('remoteSync.roundedDurationLabel') }}
            </label>
            <InputText
              :id="`remote-sync-rounded-${row.taskId}`"
              :model-value="displayedRoundedInput(row)"
              :data-testid="`remote-sync-rounded-duration-${row.taskId}`"
              @update:model-value="(value: string | undefined) => onRoundedInputChange(row, value)"
              @blur="commitRounded(row)"
              @keydown.enter="commitRounded(row)"
            />
            <Button
              v-if="row.taskId in roundedOverrides"
              text
              size="small"
              :label="t('remoteSync.resetDuration')"
              :data-testid="`remote-sync-reset-duration-${row.taskId}`"
              @click="resetRounded(row)"
            />
            <span
              v-if="isExcluded(row)"
              class="remote-sync__hint"
              :data-testid="`remote-sync-excluded-hint-${row.taskId}`"
            >
              {{
                selectedIdsFor(row).length === 0
                  ? t('remoteSync.excludedNoSelection')
                  : t('remoteSync.roundedDurationHint')
              }}
            </span>
          </template>
        </div>

        <div
          v-if="row.entries.length > 0"
          class="remote-sync__entries"
          :data-testid="`remote-sync-entries-${row.taskId}`"
        >
          <p class="remote-sync__section-title">{{ t('remoteSync.entriesHeading') }}</p>
          <div
            v-for="entry in row.entries"
            :key="entry.id"
            class="remote-sync__entry"
            :data-testid="`remote-sync-entry-${entry.id}`"
          >
            <Checkbox
              :model-value="isEntrySelected(row, entry.id)"
              binary
              :input-id="`remote-sync-entry-check-${entry.id}`"
              :disabled="stateFor(row) !== 'manageable' && stateFor(row) !== 'activity_loading'"
              :aria-label="
                t('remoteSync.entrySelectLabel', { start: formatEntryStart(entry.startedAt) })
              "
              :data-testid="`remote-sync-entry-check-${entry.id}`"
              @update:model-value="(checked: boolean) => toggleEntry(row, entry.id, checked)"
            />
            <label :for="`remote-sync-entry-check-${entry.id}`">
              {{
                t('remoteSync.entrySummary', {
                  start: formatEntryStart(entry.startedAt),
                  duration: formatDuration(entry.durationSeconds),
                })
              }}
              <span
                v-if="entry.previouslyExported"
                class="remote-sync__badge"
                :data-testid="`remote-sync-entry-exported-${entry.id}`"
              >
                {{ t('remoteSync.entryPreviouslyExported') }}
              </span>
            </label>
          </div>
        </div>

        <div
          v-if="
            stateFor(row) === 'manageable' ||
            stateFor(row) === 'activity_loading' ||
            stateFor(row) === 'activity_error' ||
            stateFor(row) === 'no_activity'
          "
          class="remote-sync__activity"
        >
          <label :for="`remote-sync-activity-${row.taskId}`">
            {{ t('remoteSync.activityLabel') }}
          </label>
          <span
            v-if="activitiesFor(row).loading || !activitiesFor(row).loaded"
            role="status"
            aria-live="polite"
            :data-testid="`remote-sync-activity-loading-${row.taskId}`"
          >
            {{ t('remoteSync.activityLoading') }}
          </span>
          <template v-else-if="activitiesFor(row).errorKey">
            <span role="alert" :data-testid="`remote-sync-activity-error-${row.taskId}`">
              {{ t('remoteSync.activityFetchError') }}
            </span>
            <Button
              text
              size="small"
              :label="t('remoteSync.activityRetry')"
              :data-testid="`remote-sync-activity-retry-${row.taskId}`"
              @click="retryActivities(row)"
            />
          </template>
          <span
            v-else-if="stateFor(row) === 'no_activity'"
            role="status"
            :data-testid="`remote-sync-no-activity-${row.taskId}`"
          >
            {{ t('remoteSync.noActivityReason') }}
          </span>
          <Select
            v-else
            :id="`remote-sync-activity-${row.taskId}`"
            :model-value="selectedActivity(row)"
            :options="activitiesFor(row).options"
            option-label="name"
            option-value="id"
            :placeholder="t('remoteSync.activityEmptyOption')"
            show-clear
            :data-testid="`remote-sync-activity-select-${row.taskId}`"
            @update:model-value="(value: string | null) => onActivityChange(row, value)"
          />
        </div>

        <div
          v-if="issueRefFor(row) && row.config"
          class="remote-sync__remote-logs"
          :data-testid="`remote-sync-remote-logs-${row.taskId}`"
        >
          <p class="remote-sync__section-title">{{ t('remoteSync.remoteLogsHeading') }}</p>
          <span
            v-if="remoteLogsFor(row).loading"
            role="status"
            aria-live="polite"
            :data-testid="`remote-sync-remote-logs-loading-${row.taskId}`"
          >
            {{ t('remoteSync.remoteLogsLoading') }}
          </span>
          <template v-else-if="remoteLogsFor(row).errorKey">
            <span role="alert" :data-testid="`remote-sync-remote-logs-error-${row.taskId}`">
              {{ t('remoteSync.remoteLogsError') }}
            </span>
            <Button
              text
              size="small"
              :label="t('remoteSync.remoteLogsRetry')"
              :data-testid="`remote-sync-remote-logs-retry-${row.taskId}`"
              @click="retryRemoteLogs(row)"
            />
          </template>
          <p
            v-else-if="remoteLogsFor(row).logs.length === 0"
            :data-testid="`remote-sync-remote-logs-empty-${row.taskId}`"
          >
            {{ t('remoteSync.remoteLogsEmpty') }}
          </p>
          <ul v-else class="remote-sync__remote-log-list">
            <li
              v-for="log in remoteLogsFor(row).logs"
              :key="log.remoteLogId"
              :data-testid="`remote-sync-remote-log-${log.remoteLogId}`"
            >
              {{
                t('remoteSync.remoteLogItem', {
                  duration: formatDuration(log.durationSeconds),
                  activity: log.activityName ?? '—',
                  id: log.remoteLogId,
                })
              }}
            </li>
          </ul>
        </div>

        <p
          v-if="outcomeText(row)"
          class="remote-sync__outcome"
          role="status"
          aria-live="polite"
          :data-testid="`remote-sync-outcome-${row.taskId}`"
          :data-outcome-status="outcomes[row.taskId]?.status"
        >
          {{ outcomeText(row) }}
        </p>

        <RemoteIssuePicker
          v-if="stateFor(row) === 'unlinked' && row.config"
          :config="toPickerConfig(row.config)"
          :data-testid="`remote-sync-link-${row.taskId}`"
          @link="(payload) => linkRemoteIssue(row, payload)"
        />
      </div>

      <div
        v-if="untitledTotal > 0"
        class="remote-sync__row remote-sync__row--untitled"
        role="listitem"
        data-testid="remote-sync-untitled-row"
      >
        <span class="remote-sync__task-name">{{ t('remoteSync.untitledBucketLabel') }}</span>
        <span data-testid="remote-sync-untitled-duration">
          {{ t('remoteSync.originalDurationLabel') }}: {{ formatDuration(untitledTotal) }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.remote-sync {
  display: grid;
  gap: 1.25rem;
}

.remote-sync__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.remote-sync__title {
  font-size: 1.5rem;
  font-weight: 600;
}

.remote-sync__total {
  font-family: monospace;
  color: var(--p-text-muted-color);
}

.remote-sync__empty {
  color: var(--p-text-muted-color);
}

.remote-sync__rows {
  display: grid;
  gap: 1rem;
}

.remote-sync__row {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.remote-sync__row-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
}

.remote-sync__state {
  font-weight: 400;
  color: var(--p-text-muted-color);
}

.remote-sync__durations,
.remote-sync__activity,
.remote-sync__remote-logs,
.remote-sync__entries {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.remote-sync__entries,
.remote-sync__remote-logs {
  align-items: flex-start;
  flex-direction: column;
}

.remote-sync__section-title {
  font-weight: 600;
  margin: 0;
}

.remote-sync__entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.remote-sync__badge {
  margin-left: 0.35rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.remote-sync__field-label {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.remote-sync__hint,
.remote-sync__outcome {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.remote-sync__remote-log-list {
  margin: 0;
  padding-left: 1.25rem;
}
</style>
