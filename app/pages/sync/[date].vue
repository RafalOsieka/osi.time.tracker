<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { applyRoundingRule } from '~~/shared/utils/rounding';
import { deriveRemoteSyncRowState } from '~~/shared/utils/remote-sync-row-state';
import type {
  RemoteSyncConfigSurfaceDto,
  RemoteSyncDayDto,
  RemoteSyncDayRowDto,
  RemoteSyncRowState,
} from '~~/shared/types/remote-sync-day';
import type { RemoteSystemConfigDto } from '~~/shared/types/remote-system-config';
import type { AdapterFieldOption } from '~~/shared/utils/openproject-adapter';
import { formatDuration } from '~/utils/formatDuration';
import { normalizeDurationInput } from '~/utils/normalizeDurationInput';
import { useRemoteActivities } from '~/composables/useRemoteActivities';
import { extractMessageKey } from '~/utils/extractMessageKey';

const route = useRoute();
const { t, locale } = useI18n();
const toast = useToast();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();

const date = computed(() => String(route.params.date));

const {
  data,
  pending,
  error: fetchError,
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

// --- Local, page-only overrides (never persisted) ---
const roundedOverrides = ref<Record<string, number>>({});
const activitySelections = ref<Record<string, string | null>>({});
const localIssueRefs = ref<Record<string, { remoteIssueId: string; cachedTitle: string }>>({});

function issueRefFor(row: RemoteSyncDayRowDto) {
  return localIssueRefs.value[row.taskId] ?? row.issueRef ?? null;
}

function stateFor(row: RemoteSyncDayRowDto): RemoteSyncRowState {
  return deriveRemoteSyncRowState({
    hasProject: !!row.projectName,
    hasClient: !!row.clientName,
    config: row.config ? { systemType: row.config.systemType } : null,
    hasIssueRef: !!issueRefFor(row),
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
    default:
      return t('remoteSync.state.manageable');
  }
}

function roundedSecondsFor(row: RemoteSyncDayRowDto): number {
  if (row.taskId in roundedOverrides.value) {
    return roundedOverrides.value[row.taskId]!;
  }
  return applyRoundingRule(row.totalSeconds, row.config!.roundingRule);
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

// --- Activities, fetched once per resolved project/work package ---
interface ActivitiesState {
  options: AdapterFieldOption[];
  loading: boolean;
  errorKey: string | null;
}

const activitiesByScopeKey = ref<Record<string, ActivitiesState>>({});

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
    executionMode: 'client',
    transportMode: config.transportMode,
    roundingRule: config.roundingRule,
    requiredFieldDefaults: config.requiredFieldDefaults,
    createdAt: '',
    updatedAt: '',
  };
}

async function ensureActivitiesLoaded(
  config: RemoteSyncConfigSurfaceDto,
  remoteIssueId: string,
  scopeKey: string,
) {
  if (activitiesByScopeKey.value[scopeKey]) return;
  activitiesByScopeKey.value = {
    ...activitiesByScopeKey.value,
    [scopeKey]: { options: [], loading: true, errorKey: null },
  };
  const { fetchOptions, options, errorKey } = useRemoteActivities(toPickerConfig(config));
  await fetchOptions(remoteIssueId);
  activitiesByScopeKey.value = {
    ...activitiesByScopeKey.value,
    [scopeKey]: { options: options.value, loading: false, errorKey: errorKey.value },
  };
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      const remoteIssueId = issueRefFor(row)?.remoteIssueId;
      const scopeKey = activitiesScopeKeyFor(row);
      if (row.config && remoteIssueId && scopeKey && stateFor(row) === 'manageable') {
        void ensureActivitiesLoaded(row.config, remoteIssueId, scopeKey);
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
    }
  );
}

function selectedActivity(row: RemoteSyncDayRowDto): string | null {
  const explicit = activitySelections.value[row.taskId];
  if (explicit !== undefined) return explicit;
  const defaultId = row.config?.requiredFieldDefaults?.activity;
  const options = activitiesFor(row).options;
  const match = defaultId ? options.find((option) => option.id === defaultId) : undefined;
  return match ? match.id : null;
}

function onActivityChange(row: RemoteSyncDayRowDto, value: string | null) {
  activitySelections.value = { ...activitySelections.value, [row.taskId]: value };
}

// --- Inline linking (reuses the shared remote-issue picker) ---
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
  } catch (err: unknown) {
    toast.add({
      severity: 'error',
      summary: t(extractMessageKey(err, 'errors.unexpected')),
      life: 4000,
    });
  }
}
</script>

<template>
  <section class="remote-sync" data-testid="remote-sync-page">
    <h2 class="remote-sync__title" data-testid="remote-sync-heading">
      {{ t('remoteSync.pageTitle', { date: dayHeading() }) }}
    </h2>
    <p class="remote-sync__total" data-testid="remote-sync-day-total">
      {{ t('remoteSync.dayTotal', { duration: formatDuration(totalSeconds) }) }}
    </p>

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

          <template v-if="stateFor(row) === 'manageable'">
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
            <span
              v-if="roundedSecondsFor(row) === 0"
              class="remote-sync__hint"
              :data-testid="`remote-sync-excluded-hint-${row.taskId}`"
            >
              {{ t('remoteSync.roundedDurationHint') }}
            </span>
          </template>
        </div>

        <div v-if="stateFor(row) === 'manageable'" class="remote-sync__activity">
          <label :for="`remote-sync-activity-${row.taskId}`">
            {{ t('remoteSync.activityLabel') }}
          </label>
          <span v-if="activitiesFor(row).loading" role="status" aria-live="polite">
            {{ t('remoteSync.activityLoading') }}
          </span>
          <span
            v-else-if="activitiesFor(row).errorKey"
            role="alert"
            :data-testid="`remote-sync-activity-error-${row.taskId}`"
          >
            {{ t('remoteSync.activityFetchError') }}
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

.remote-sync__durations {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.remote-sync__field-label {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.remote-sync__hint {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.remote-sync__activity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
