<script setup lang="ts">
import { useI18n } from 'vue-i18n';
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
import type { RemoteSystemConfigDto } from '~~/shared/types/remote-system-config';
import { formatDuration } from '~/utils/formatDuration';
import { useRemoteActivities } from '~/composables/useRemoteActivities';
import { useRemoteDayLogs } from '~/composables/useRemoteDayLogs';
import { useRoundedDurations } from '~/composables/useRoundedDurations';
import { useSyncExport } from '~/composables/useSyncExport';
import { extractMessageKey } from '~/utils/extractMessageKey';

const route = useRoute();
const { t, locale } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
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
  reset: resetRoundedDuration,
  hasOverride: hasRoundedOverride,
} = useRoundedDurations();

const {
  outcomes,
  isRunning: exporting,
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
  refresh,
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
  return roundedComputedSeconds(row.taskId, selectedSecondsFor(row), row.config!.roundingRule);
}

function displayedRoundedInput(row: RemoteSyncDayRowDto): string {
  return roundedDisplayedInput(row.taskId, selectedSecondsFor(row), row.config!.roundingRule);
}

function onRoundedInputChange(row: RemoteSyncDayRowDto, value: string | undefined) {
  setRoundedInput(row.taskId, value);
}

function commitRounded(row: RemoteSyncDayRowDto) {
  commitRoundedDuration(row.taskId, selectedSecondsFor(row), row.config!.roundingRule);
}

function resetRounded(row: RemoteSyncDayRowDto) {
  resetRoundedDuration(row.taskId);
}

function isExcluded(row: RemoteSyncDayRowDto): boolean {
  return selectedIdsFor(row).length === 0 || roundedSecondsFor(row) === 0;
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

function startExport() {
  const candidates = pushableRows();
  if (candidates.length === 0) return;

  const repeatTasks = candidates.filter((row) =>
    selectedIdsFor(row).some(
      (id) => row.entries.find((entry) => entry.id === id)?.previouslyExported,
    ),
  );

  const launch = async () => {
    await runExport(
      candidates.map((row) => ({
        row,
        config: toPickerConfig(row.config!),
        remoteIssueId: issueRefFor(row)!.remoteIssueId,
        activityId: selectedActivity(row)!,
        durationSeconds: roundedSecondsFor(row),
        entryIds: selectedIdsFor(row),
        spentOn: date.value,
      })),
    );
  };

  if (repeatTasks.length > 0) {
    void (async () => {
      const accepted = await confirm({
        title: t('remoteSync.repeatConfirmHeader'),
        description: t('remoteSync.repeatConfirmMessage', {
          tasks: repeatTasks.map((row) => row.taskName).join(', '),
        }),
        confirmLabel: t('remoteSync.repeatConfirmAccept'),
        cancelLabel: t('remoteSync.repeatConfirmReject'),
      });
      if (accepted) {
        await launch();
      }
    })();
    return;
  }

  void launch();
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
  <section class="grid gap-5" data-testid="remote-sync-page">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold" data-testid="remote-sync-heading">
          {{ t('remoteSync.pageTitle', { date: dayHeading() }) }}
        </h2>
        <p class="font-mono text-muted" data-testid="remote-sync-day-total">
          {{ t('remoteSync.dayTotal', { duration: formatDuration(totalSeconds) }) }}
        </p>
      </div>
      <UButton
        :label="exporting ? t('remoteSync.exporting') : t('remoteSync.exportButton')"
        :disabled="exporting || pushableRows().length === 0"
        data-testid="remote-sync-export-button"
        @click="startExport"
      />
    </div>

    <p v-if="isEmpty" class="text-muted" data-testid="remote-sync-empty-state">
      {{ t('remoteSync.emptyState') }}
    </p>

    <div v-else class="grid gap-4" role="list">
      <div
        v-for="row in rows"
        :key="row.taskId"
        class="grid gap-2 border-b border-default py-3"
        role="listitem"
        :data-testid="`remote-sync-row-${row.taskId}`"
      >
        <div class="flex justify-between gap-4 font-semibold">
          <span :data-testid="`remote-sync-task-name-${row.taskId}`">
            {{ row.taskName }}
          </span>
          <span class="font-normal text-muted" :data-testid="`remote-sync-state-${row.taskId}`">
            {{ reasonKeyFor(row) }}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <span :data-testid="`remote-sync-original-duration-${row.taskId}`">
            {{ t('remoteSync.originalDurationLabel') }}: {{ formatDuration(row.totalSeconds) }}
          </span>

          <template v-if="stateFor(row) === 'manageable' || stateFor(row) === 'activity_loading'">
            <span :data-testid="`remote-sync-selected-duration-${row.taskId}`">
              {{ t('remoteSync.selectedDurationLabel') }}:
              {{ formatDuration(selectedSecondsFor(row)) }}
            </span>
            <label :for="`remote-sync-rounded-${row.taskId}`" class="text-sm text-muted">
              {{ t('remoteSync.roundedDurationLabel') }}
            </label>
            <UInput
              :id="`remote-sync-rounded-${row.taskId}`"
              :model-value="displayedRoundedInput(row)"
              :data-testid="`remote-sync-rounded-duration-${row.taskId}`"
              @update:model-value="(value: string | undefined) => onRoundedInputChange(row, value)"
              @blur="commitRounded(row)"
              @keydown.enter="commitRounded(row)"
            />
            <UButton
              v-if="hasRoundedOverride(row.taskId)"
              variant="ghost"
              size="sm"
              :label="t('remoteSync.resetDuration')"
              :data-testid="`remote-sync-reset-duration-${row.taskId}`"
              @click="resetRounded(row)"
            />
            <span
              v-if="isExcluded(row)"
              class="text-sm text-muted"
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
          class="flex flex-col flex-wrap items-start gap-3"
          :data-testid="`remote-sync-entries-${row.taskId}`"
        >
          <p class="m-0 font-semibold">{{ t('remoteSync.entriesHeading') }}</p>
          <div
            v-for="entry in row.entries"
            :key="entry.id"
            class="flex items-center gap-2"
            :data-testid="`remote-sync-entry-${entry.id}`"
          >
            <UCheckbox
              :model-value="isEntrySelected(row, entry.id)"
              :input-id="`remote-sync-entry-check-${entry.id}`"
              :disabled="stateFor(row) !== 'manageable' && stateFor(row) !== 'activity_loading'"
              :aria-label="
                t('remoteSync.entrySelectLabel', { start: formatEntryStart(entry.startedAt) })
              "
              :data-testid="`remote-sync-entry-check-${entry.id}`"
              @update:model-value="
                (checked: boolean | 'indeterminate') => toggleEntry(row, entry.id, checked === true)
              "
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
                class="ml-1.5 text-xs text-muted"
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
          class="flex flex-wrap items-center gap-3"
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
            <UButton
              variant="ghost"
              size="sm"
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
          <USelect
            v-else
            :id="`remote-sync-activity-${row.taskId}`"
            :model-value="selectedActivity(row)"
            :items="activitiesFor(row).options"
            label-key="name"
            value-key="id"
            :placeholder="t('remoteSync.activityEmptyOption')"
            :data-testid="`remote-sync-activity-select-${row.taskId}`"
            @update:model-value="(value: string | undefined) => onActivityChange(row, value)"
          />
        </div>

        <div
          v-if="issueRefFor(row) && row.config"
          class="flex flex-col flex-wrap items-start gap-3"
          :data-testid="`remote-sync-remote-logs-${row.taskId}`"
        >
          <p class="m-0 font-semibold">{{ t('remoteSync.remoteLogsHeading') }}</p>
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
            <UButton
              variant="ghost"
              size="sm"
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
          <ul v-else class="m-0 pl-5">
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
          class="text-sm text-muted"
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
        class="grid gap-2 border-b border-default py-3"
        role="listitem"
        data-testid="remote-sync-untitled-row"
      >
        <span class="font-semibold">{{ t('remoteSync.untitledBucketLabel') }}</span>
        <span data-testid="remote-sync-untitled-duration">
          {{ t('remoteSync.originalDurationLabel') }}: {{ formatDuration(untitledTotal) }}
        </span>
      </div>
    </div>
  </section>
</template>
