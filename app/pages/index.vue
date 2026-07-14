<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computeWindowRange, groupTimeEntriesByDay } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import { toPickerDate } from '~/utils/dateTime';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const { t, locale } = useI18n();
const { running, elapsedSeconds, start, fetchRunning } = useTimer();
const { effective } = useUserSettings();

const DEFAULT_WINDOW_DAYS = 7;
const LOAD_MORE_DAYS = 7;

const windowDays = ref(DEFAULT_WINDOW_DAYS);

const initialTimeZone = effective.value.timeZone;
const initialWeekStart = effective.value.weekStart;
const windowRange = computed(() =>
  computeWindowRange(windowDays.value, new Date(), {
    timeZone: initialTimeZone,
    weekStart: initialWeekStart,
  }),
);

const {
  data: entriesData,
  pending: entriesPending,
  refresh: refreshEntries,
} = useAsyncData(
  'timer-view-entries',
  () => $fetch<TimeEntryDto[]>('/api/time-entries', { query: windowRange.value }),
  { server: false, watch: [windowRange] },
);

const { data: projectsData } = useAsyncData(
  'projects-for-timer-view',
  () => $fetch<ProjectDto[]>('/api/projects'),
  { server: false },
);
const projectOptions = computed(() => projectsData.value ?? []);
const activeEditorKey = ref<string | null>(null);

const { ensureLoaded: ensureRemoteConfigLoaded, getConfig: getRemoteConfigForClient } =
  useActiveRemoteConfigs();

function clientIdForProject(projectId: string | null): string | null {
  return projectOptions.value.find((p) => p.id === projectId)?.clientId ?? null;
}

watch(
  projectOptions,
  (options) => {
    const clientIds = new Set(options.map((p) => p.clientId));
    for (const clientId of clientIds) {
      void ensureRemoteConfigLoaded(clientId);
    }
  },
  { immediate: true },
);

function remoteConfigForGroup(group: { projectId: string | null }) {
  return getRemoteConfigForClient(clientIdForProject(group.projectId));
}

const now = ref(Date.now());
watch(elapsedSeconds, () => {
  now.value = Date.now();
});

const displayEntries = computed<TimeEntryDto[]>(() => {
  const list = entriesData.value ? [...entriesData.value] : [];
  if (running.value) {
    const idx = list.findIndex((e) => e.id === running.value!.id);
    if (idx >= 0) {
      list[idx] = running.value;
    } else {
      list.unshift(running.value);
    }
  }
  return list;
});

let lastRunningId = running.value?.id ?? null;
watch(
  () => running.value?.id ?? null,
  async (runningId) => {
    const previousId = lastRunningId;
    lastRunningId = runningId;
    if ((previousId && !runningId) || (previousId && runningId && previousId !== runningId)) {
      await refreshEntries();
    }
  },
);

const days = computed(() =>
  groupTimeEntriesByDay(displayEntries.value, now.value, effective.value),
);
const isEmpty = computed(() => !entriesPending.value && days.value.length === 0);

function dayHeading(dayKey: string): string {
  return new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: effective.value.timeZone,
  });
}

function isGroupLive(group: { entries: TimeEntryDto[] }): boolean {
  return !!running.value && group.entries.some((e) => e.id === running.value!.id);
}

function startGroupEditing(groupKey: string) {
  activeEditorKey.value = groupKey;
}

async function onContinue(group: { taskName: string | null; projectId: string | null }) {
  await start(group.taskName ?? undefined, group.projectId ?? undefined);
  await refreshEntries();
}

function loadMore() {
  windowDays.value += LOAD_MORE_DAYS;
}

// --- Bulk assign ---
const bulkAssignVisible = ref(false);
const bulkAssignIds = ref<string[]>([]);

function openBulkAssign(ids: string[]) {
  bulkAssignIds.value = ids;
  bulkAssignVisible.value = true;
}

async function onBulkAssigned() {
  await refreshEntries();
  await fetchRunning();
}

// --- Add entry ---
const addEntryVisible = ref(false);
const addEntryDate = ref<Date | null>(null);
function openAddEntry(dayKey: string) {
  addEntryDate.value = toPickerDate(dayKey, effective.value.timeZone);
  addEntryVisible.value = true;
}

async function onEntryAdded() {
  await refreshEntries();
}

async function onEntryChanged() {
  await refreshEntries();
  await fetchRunning();
}

async function onEntryDeleted() {
  await refreshEntries();
  await fetchRunning();
}
</script>

<template>
  <section class="timer-view" data-testid="timer-view-page">
    <h2 class="timer-view__title">{{ t('timerView.pageTitle') }}</h2>

    <ClientOnly>
      <EmptyState
        v-if="isEmpty"
        :message="t('timerView.emptyState')"
        :cta-label="t('timerView.loadMore')"
        testid="timer-view-empty-state"
        @create="loadMore"
      />

      <div v-else class="timer-view__days">
        <div
          v-for="day in days"
          :key="day.dayKey"
          class="timer-day"
          :data-testid="`timer-day-${day.dayKey}`"
        >
          <div class="timer-day__heading">
            <span class="timer-day__date">{{ dayHeading(day.dayKey) }}</span>
            <span class="timer-day__total" :data-testid="`timer-day-total-${day.dayKey}`">
              {{ t('timerView.dayTotal', { duration: formatDuration(day.totalSeconds) }) }}
            </span>
            <Button
              :label="t('timerView.addEntry.buttonLabel')"
              icon="pi pi-plus"
              text
              :data-testid="`timer-day-add-entry-${day.dayKey}`"
              @click="openAddEntry(day.dayKey)"
            />
          </div>

          <TimerTaskGroup
            v-for="group in day.groups"
            :key="group.key"
            :editor-key="`${day.dayKey}:${group.key}`"
            :group="group"
            :is-live="isGroupLive(group)"
            :now="now"
            :time-zone="effective.timeZone"
            :active-editor-key="activeEditorKey"
            :project-options="projectOptions"
            :remote-config="remoteConfigForGroup(group)"
            @editing-started="startGroupEditing(`${day.dayKey}:${group.key}`)"
            @continue="onContinue(group)"
            @bulk-assign="openBulkAssign(group.entries.map((e) => e.id))"
            @entry-changed="onEntryChanged"
            @entry-deleted="onEntryDeleted"
          />
        </div>

        <div class="timer-view__load-more">
          <Button
            :label="t('timerView.loadMore')"
            text
            data-testid="timer-view-load-more"
            @click="loadMore"
          />
        </div>
      </div>
    </ClientOnly>

    <TimerBulkAssignDialog
      v-model:visible="bulkAssignVisible"
      :ids="bulkAssignIds"
      :project-options="projectOptions"
      @assigned="onBulkAssigned"
    />

    <TimerAddEntryDialog
      v-model:visible="addEntryVisible"
      :date="addEntryDate"
      :time-zone="effective.timeZone"
      @added="onEntryAdded"
    />
  </section>
</template>

<style scoped>
.timer-view {
  display: grid;
  gap: 1.5rem;
}

.timer-view__title {
  font-size: 1.5rem;
  font-weight: 600;
}

.timer-view__days {
  display: grid;
  gap: 1.5rem;
}

.timer-day {
  display: grid;
  gap: 0.25rem;
}

.timer-day__heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-weight: 600;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid var(--p-content-border-color);
}

.timer-day__total {
  font-family: monospace;
  font-weight: 400;
  color: var(--p-text-muted-color);
}

.timer-view__load-more {
  display: flex;
  justify-content: center;
}
</style>
