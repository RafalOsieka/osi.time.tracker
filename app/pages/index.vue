<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computeWindowRange, groupTimeEntriesByDay } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const { t, locale } = useI18n();
const { running, elapsedSeconds, start } = useTimer();

const DEFAULT_WINDOW_DAYS = 7;
const LOAD_MORE_DAYS = 7;

const windowDays = ref(DEFAULT_WINDOW_DAYS);

const windowRange = computed(() => computeWindowRange(windowDays.value));

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

const days = computed(() => groupTimeEntriesByDay(displayEntries.value, now.value));
const isEmpty = computed(() => !entriesPending.value && days.value.length === 0);

function dayHeading(date: Date): string {
  return date.toLocaleDateString(locale.value, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isGroupLive(group: { entries: TimeEntryDto[] }): boolean {
  return !!running.value && group.entries.some((e) => e.id === running.value!.id);
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

// --- Mini editor ---
const editorVisible = ref(false);
const editingTask = ref<{
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
} | null>(null);

function openEditor(group: {
  taskId: string | null;
  taskName: string | null;
  projectId: string | null;
  projectName: string | null;
}) {
  if (!group.taskId) return;
  editingTask.value = {
    id: group.taskId,
    name: group.taskName ?? '',
    projectId: group.projectId,
    projectName: group.projectName,
  };
  editorVisible.value = true;
}

async function onTaskUpdated() {
  await refreshEntries();
  await fetchRunning();
}

// --- Add entry ---
const addEntryVisible = ref(false);
const addEntryDate = ref<Date | null>(null);
const { fetchRunning } = useTimer();

function openAddEntry(date: Date) {
  addEntryDate.value = date;
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
            <span class="timer-day__date">{{ dayHeading(day.date) }}</span>
            <span class="timer-day__total" :data-testid="`timer-day-total-${day.dayKey}`">
              {{ t('timerView.dayTotal', { duration: formatDuration(day.totalSeconds) }) }}
            </span>
            <Button
              :label="t('timerView.addEntry.buttonLabel')"
              icon="pi pi-plus"
              text
              :data-testid="`timer-day-add-entry-${day.dayKey}`"
              @click="openAddEntry(day.date)"
            />
          </div>

          <TimerTaskGroup
            v-for="group in day.groups"
            :key="group.key"
            :group="group"
            :is-live="isGroupLive(group)"
            :now="now"
            @continue="onContinue(group)"
            @edit="openEditor(group)"
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

    <TimerTaskEditorDialog
      v-model:visible="editorVisible"
      :task="editingTask"
      :project-options="projectOptions"
      @updated="onTaskUpdated"
    />

    <TimerAddEntryDialog
      v-model:visible="addEntryVisible"
      :date="addEntryDate"
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
