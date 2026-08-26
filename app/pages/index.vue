<script setup lang="ts">
import type { TimerViewFeedDto, TimeEntryDto } from '~~/shared/types/time-entry';

const { t, locale } = useI18n();
const { running, elapsedSeconds, start, stop, fetchRunning } = useTimer();
const { effective } = useUserSettings();
const requestFetch = useRequestFetch();

const { data: feedData, pending: feedPending } = await useAsyncData('timer-view-feed', () =>
  requestFetch<TimerViewFeedDto>('/api/time-entries/feed'),
);

const { data: projectsData, refresh: refreshProjectOptions } = useAsyncData(
  'projects-for-timer-view',
  () => requestFetch<ProjectDto[]>('/api/projects'),
  { server: false, immediate: false },
);

onMounted(() => {
  void refreshProjectOptions();
});

/**
 * Client-owned feed state. Survives mutations so load-more expansion is not
 * wiped when re-fetching after edit/create/delete.
 */
const entries = ref<TimeEntryDto[]>([]);
const hasMore = ref(false);
const nextBefore = ref<string | null>(null);
/**
 * Inclusive lower bound of the loaded window (ISO day start). Remembered so a
 * refresh can re-walk load-more pages back to this depth without a new query param.
 */
const loadedFrom = ref<string | null>(null);
const loadingMore = ref(false);
const refreshing = ref(false);

function oldestDayStart(list: TimeEntryDto[], timeZone: string): string | null {
  if (list.length === 0) return null;
  let oldestDay: string | null = null;
  for (const entry of list) {
    const day = localDayKey(entry.startedAt, timeZone);
    if (oldestDay == null || day < oldestDay) oldestDay = day;
  }
  return oldestDay ? localDayBounds(oldestDay, timeZone).from : null;
}

function mergeById(base: TimeEntryDto[], extra: TimeEntryDto[]): TimeEntryDto[] {
  const byId = new Map<string, TimeEntryDto>();
  for (const entry of base) byId.set(entry.id, entry);
  for (const entry of extra) byId.set(entry.id, entry);
  return Array.from(byId.values());
}

function applyFeed(page: TimerViewFeedDto, mode: 'replace' | 'append') {
  if (mode === 'append') {
    entries.value = mergeById(entries.value, page.entries);
  } else {
    entries.value = page.entries;
  }
  hasMore.value = page.hasMore;
  nextBefore.value = page.nextBefore;

  // Expand or set the lower bound; never shrink it when appending.
  const pageBound = page.nextBefore ?? oldestDayStart(page.entries, effective.value.timeZone);
  if (pageBound) {
    if (!loadedFrom.value || pageBound < loadedFrom.value) {
      loadedFrom.value = pageBound;
    }
  } else if (mode === 'replace' && page.entries.length === 0) {
    loadedFrom.value = null;
  }
}

// Seed from SSR / first payload once.
watch(
  feedData,
  (feed) => {
    if (!feed) return;
    if (entries.value.length === 0 && !loadedFrom.value) {
      applyFeed(feed, 'replace');
    }
  },
  { immediate: true },
);

const projectOptions = computed(() => projectsData.value ?? []);
const activeEditorKey = ref<string | null>(null);

const { ensureLoaded: ensureTrackerLoaded, getTracker } = useActiveTrackers();

function trackerIdForProject(projectId: string | null): string | null {
  return projectOptions.value.find((p) => p.id === projectId)?.trackerId ?? null;
}

watch(
  projectOptions,
  (options) => {
    const trackerIds = new Set(options.map((p) => p.trackerId).filter((id): id is string => !!id));
    for (const trackerId of trackerIds) {
      void ensureTrackerLoaded(trackerId);
    }
  },
  { immediate: true },
);

function trackerForGroup(group: { projectId: string | null }) {
  return getTracker(trackerIdForProject(group.projectId));
}

const now = ref(0);
onMounted(() => {
  now.value = Date.now();
});
watch(elapsedSeconds, () => {
  now.value = Date.now();
});

const displayEntries = computed<TimeEntryDto[]>(() => {
  const list = [...entries.value];
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

/**
 * Re-fetch the currently loaded window using only existing feed endpoints:
 * initial page, then load-more (`before`) until we reach the previous depth.
 */
async function refreshLoadedRange() {
  if (refreshing.value) return;
  refreshing.value = true;
  const targetFrom = loadedFrom.value;
  try {
    let page = await fetchTimerViewFeed();
    let merged = page.entries;
    let pageHasMore = page.hasMore;
    let pageNextBefore = page.nextBefore;

    // Re-walk older pages until we cover the previously expanded lower bound.
    // `nextBefore` is an ISO day-start; older bounds are lexicographically smaller.
    const maxPages = 50;
    let pages = 0;
    while (
      targetFrom &&
      pageHasMore &&
      pageNextBefore &&
      pageNextBefore > targetFrom &&
      pages < maxPages
    ) {
      page = await fetchTimerViewFeed(pageNextBefore);
      merged = mergeById(merged, page.entries);
      pageHasMore = page.hasMore;
      pageNextBefore = page.nextBefore;
      pages += 1;
    }

    // One more page if we still haven't reached targetFrom but have more history
    // (nextBefore may jump past targetFrom in a single 7-day step — that's fine;
    // if nextBefore is still > targetFrom we already looped; if nextBefore <= targetFrom stop).
    if (targetFrom && pageHasMore && pageNextBefore && pageNextBefore === targetFrom) {
      // Already at the same cursor depth; no extra page needed.
    }

    entries.value = merged;
    hasMore.value = pageHasMore;
    nextBefore.value = pageNextBefore;

    // Restore / recompute lower bound without shrinking past what we had.
    const bound = pageNextBefore ?? oldestDayStart(merged, effective.value.timeZone);
    if (targetFrom) {
      loadedFrom.value = bound && bound < targetFrom ? bound : targetFrom;
    } else {
      loadedFrom.value = bound;
    }
  } finally {
    refreshing.value = false;
  }
}

let lastRunningId = running.value?.id ?? null;
watch(
  () => running.value?.id ?? null,
  async (runningId) => {
    const previousId = lastRunningId;
    lastRunningId = runningId;

    if ((previousId && !runningId) || (previousId && runningId && previousId !== runningId)) {
      await refreshLoadedRange();
    }
  },
);

const days = computed(() =>
  groupTimeEntriesByDay(displayEntries.value, now.value, effective.value),
);

const isNeverTracked = computed(
  () =>
    !feedPending.value &&
    !refreshing.value &&
    entries.value.length === 0 &&
    !running.value &&
    !hasMore.value,
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
  await refreshLoadedRange();
}

async function onStop() {
  await stop();
}

async function loadMore() {
  if (!hasMore.value || !nextBefore.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await $fetch<TimerViewFeedDto>('/api/time-entries/feed', {
      query: { before: nextBefore.value },
    });
    applyFeed(page, 'append');
  } finally {
    loadingMore.value = false;
  }
}

function focusTimerWidget() {
  const root = document.querySelector('[data-testid="timer-title-input"]');
  const input = root instanceof HTMLInputElement ? root : root?.querySelector('input');
  if (input instanceof HTMLElement) {
    input.focus();
  }
}

// --- Add entry ---
const addEntryVisible = ref(false);

function openAddEntry() {
  addEntryVisible.value = true;
}

function smartInclude(entry: TimeEntryDto) {
  entries.value = mergeById(entries.value, [entry]);
  const dayStart = localDayBounds(
    localDayKey(entry.startedAt, effective.value.timeZone),
    effective.value.timeZone,
  ).from;
  if (!loadedFrom.value || dayStart < loadedFrom.value) {
    loadedFrom.value = dayStart;
  }
}

async function onEntryAdded(entry: TimeEntryDto) {
  const day = localDayKey(entry.startedAt, effective.value.timeZone);
  const loadedDays = new Set(
    entries.value.map((e) => localDayKey(e.startedAt, effective.value.timeZone)),
  );
  if (loadedDays.has(day) || (loadedFrom.value && entry.startedAt >= loadedFrom.value)) {
    await refreshLoadedRange();
  } else {
    smartInclude(entry);
  }
}

async function onEntryChanged() {
  await refreshLoadedRange();
  await fetchRunning();
}

async function onEntryDeleted() {
  await refreshLoadedRange();
  await fetchRunning();
}
</script>

<template>
  <section class="grid gap-6" data-testid="timer-view-page">
    <TableHeader
      :title="t('timerView.pageTitle')"
      :new-label="t('timerView.addEntry.buttonLabel')"
      new-testid="timer-view-add-entry"
      @create="openAddEntry"
    />

    <EmptyState
      v-if="isNeverTracked"
      :message="t('timerView.neverTrackedEmptyState')"
      :cta-label="t('timerView.neverTrackedCta')"
      testid="timer-view-never-tracked"
      @create="focusTimerWidget"
    />

    <div v-else-if="hasEntries" class="grid gap-6">
      <div
        v-for="day in days"
        :key="day.dayKey"
        class="grid gap-1"
        :data-testid="`timer-day-${day.dayKey}`"
      >
        <div
          class="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-default pb-1 font-semibold"
        >
          <span>{{ dayHeading(day.dayKey) }}</span>
          <span
            class="min-w-[4.5rem] font-mono text-sm font-medium tabular-nums text-muted"
            :data-testid="`timer-day-total-${day.dayKey}`"
          >
            {{ t('timerView.dayTotal', { duration: formatDuration(day.totalSeconds) }) }}
          </span>
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
          :tracker="trackerForGroup(group)"
          @editing-started="startGroupEditing(`${day.dayKey}:${group.key}`)"
          @continue="onContinue(group)"
          @stop="onStop"
          @entry-changed="onEntryChanged"
          @entry-deleted="onEntryDeleted"
        />
      </div>

      <div v-if="hasMore" class="flex justify-center">
        <UButton
          :label="t('timerView.loadMore')"
          variant="ghost"
          :loading="loadingMore"
          data-testid="timer-view-load-more"
          @click="loadMore"
        />
      </div>
    </div>

    <TimerAddEntryDialog
      v-model:visible="addEntryVisible"
      :time-zone="effective.timeZone"
      @added="onEntryAdded"
    />
  </section>
</template>
