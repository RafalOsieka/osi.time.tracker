<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computeWindowRange, groupTimeEntriesByDay } from '~/utils/timerViewGrouping';
import { formatDuration } from '~/utils/formatDuration';
import { toPickerDate } from '~/utils/dateTime';
import type { LatestTimeEntryDto, TimeEntryDto } from '../../shared/types/time-entry';

const { t, locale } = useI18n();
const { running, elapsedSeconds, start, fetchRunning } = useTimer();
const { effective } = useUserSettings();

const DEFAULT_WINDOW_DAYS = 7;
const LOAD_MORE_DAYS = 7;

const windowDays = ref(DEFAULT_WINDOW_DAYS);
/** Cached newest-entry instant; `undefined` until loaded, `null` when never tracked. */
const anchorStartedAt = ref<string | null | undefined>(undefined);
const forceCurrentWeek = ref(false);

// Freeze timezone for the range fetch so a timezone-only settings change regroups
// without refetching (REQ-150). weekStart stays reactive so a change re-aligns.
const initialTimeZone = effective.value.timeZone;

const windowReference = computed(() => {
  if (forceCurrentWeek.value || !anchorStartedAt.value) {
    return new Date();
  }
  return new Date(anchorStartedAt.value);
});

const windowRange = computed(() =>
  computeWindowRange(windowDays.value, windowReference.value, {
    timeZone: initialTimeZone,
    weekStart: effective.value.weekStart,
  }),
);

const showAnchoredWeekBanner = computed(() => {
  if (forceCurrentWeek.value || !anchorStartedAt.value) return false;
  const settings = {
    timeZone: initialTimeZone,
    weekStart: effective.value.weekStart,
  };
  const currentFrom = computeWindowRange(DEFAULT_WINDOW_DAYS, new Date(), settings).from;
  const anchorFrom = computeWindowRange(
    DEFAULT_WINDOW_DAYS,
    new Date(anchorStartedAt.value),
    settings,
  ).from;
  return currentFrom !== anchorFrom;
});

const anchoredWeekLabel = computed(() => {
  if (!anchorStartedAt.value) return '';
  const { from } = computeWindowRange(DEFAULT_WINDOW_DAYS, new Date(anchorStartedAt.value), {
    timeZone: initialTimeZone,
    weekStart: effective.value.weekStart,
  });
  return new Date(from).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: effective.value.timeZone,
  });
});

// `immediate: false` + fetching in `onMounted` keeps `pending` at `false` during
// hydration (matching the server-rendered markup) instead of flipping to `true`
// synchronously during setup, which caused a hydration mismatch on the empty state.
const {
  data: entriesData,
  pending: entriesPending,
  refresh: refreshEntries,
} = useAsyncData(
  'timer-view-entries',
  () => $fetch<TimeEntryDto[]>('/api/time-entries', { query: windowRange.value }),
  { server: false, immediate: false, watch: [windowRange] },
);

const { data: projectsData, refresh: refreshProjectOptions } = useAsyncData(
  'projects-for-timer-view',
  () => $fetch<ProjectDto[]>('/api/projects'),
  { server: false, immediate: false },
);

onMounted(async () => {
  try {
    const latest = await $fetch<LatestTimeEntryDto>('/api/time-entries/latest');
    anchorStartedAt.value = latest?.startedAt ?? null;
  } catch {
    anchorStartedAt.value = null;
  }
  if (anchorStartedAt.value) {
    await refreshEntries();
  }
  void refreshProjectOptions();
});

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

    // First-ever start must leave the never-tracked empty state so the live
    // (and later stopped) entry can render in the list.
    if (runningId && running.value && anchorStartedAt.value == null) {
      anchorStartedAt.value = running.value.startedAt;
    }

    if ((previousId && !runningId) || (previousId && runningId && previousId !== runningId)) {
      if (!runningId && anchorStartedAt.value == null) {
        try {
          const latest = await $fetch<LatestTimeEntryDto>('/api/time-entries/latest');
          anchorStartedAt.value = latest?.startedAt ?? null;
        } catch {
          // Keep null; refresh below is still best-effort.
        }
      }
      await refreshEntries();
    }
  },
);

const days = computed(() =>
  groupTimeEntriesByDay(displayEntries.value, now.value, effective.value),
);

const anchorReady = computed(() => anchorStartedAt.value !== undefined);
const isNeverTracked = computed(() => anchorReady.value && anchorStartedAt.value === null);
const isEmptyWindow = computed(
  () =>
    anchorReady.value &&
    anchorStartedAt.value !== null &&
    !entriesPending.value &&
    days.value.length === 0,
);
const hasEntries = computed(() => days.value.length > 0);

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
  // Explicit refresh: watching a computed object source can miss updates depending on
  // Nuxt/Vue timing; keep the watch as a belt-and-suspenders path.
  void refreshEntries();
}

function resetToCurrentWeek() {
  forceCurrentWeek.value = true;
  windowDays.value = DEFAULT_WINDOW_DAYS;
  void refreshEntries();
}

function focusTimerWidget() {
  const root = document.querySelector('[data-testid="timer-title-input"]');
  const input = root instanceof HTMLInputElement ? root : root?.querySelector('input');
  if (input instanceof HTMLElement) {
    input.focus();
  }
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
  <section class="grid gap-6" data-testid="timer-view-page">
    <h2 class="text-2xl font-semibold">{{ t('timerView.pageTitle') }}</h2>

    <ClientOnly>
      <EmptyState
        v-if="isNeverTracked"
        :message="t('timerView.neverTrackedEmptyState')"
        :cta-label="t('timerView.neverTrackedCta')"
        testid="timer-view-never-tracked"
        @create="focusTimerWidget"
      />

      <EmptyState
        v-else-if="isEmptyWindow"
        :message="t('timerView.emptyWindowState')"
        :cta-label="t('timerView.loadMore')"
        testid="timer-view-empty-state"
        @create="loadMore"
      />

      <div v-else-if="hasEntries" class="grid gap-6">
        <div
          v-if="showAnchoredWeekBanner"
          class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-default bg-elevated px-3 py-2"
          data-testid="timer-view-anchored-week-banner"
        >
          <p class="m-0 text-sm text-muted">
            {{ t('timerView.anchoredWeekBanner', { week: anchoredWeekLabel }) }}
          </p>
          <UButton
            :label="t('timerView.resetToCurrentWeek')"
            variant="soft"
            size="sm"
            data-testid="timer-view-reset-to-current-week"
            @click="resetToCurrentWeek"
          />
        </div>

        <div
          v-for="day in days"
          :key="day.dayKey"
          class="grid gap-1"
          :data-testid="`timer-day-${day.dayKey}`"
        >
          <div
            class="flex items-baseline justify-between border-b-2 border-default pb-1 font-semibold"
          >
            <span>{{ dayHeading(day.dayKey) }}</span>
            <span
              class="font-mono font-normal text-muted"
              :data-testid="`timer-day-total-${day.dayKey}`"
            >
              {{ t('timerView.dayTotal', { duration: formatDuration(day.totalSeconds) }) }}
            </span>
            <UButton
              :label="t('timerView.addEntry.buttonLabel')"
              icon="i-lucide-plus"
              variant="ghost"
              :data-testid="`timer-day-add-entry-${day.dayKey}`"
              @click="openAddEntry(day.dayKey)"
            />
            <NuxtLink
              :to="`/sync/${day.dayKey}`"
              class="text-sm text-primary no-underline"
              :data-testid="`timer-day-remote-sync-${day.dayKey}`"
            >
              {{ t('timerView.remoteSyncAction') }}
            </NuxtLink>
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

        <div class="flex justify-center">
          <UButton
            :label="t('timerView.loadMore')"
            variant="ghost"
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
