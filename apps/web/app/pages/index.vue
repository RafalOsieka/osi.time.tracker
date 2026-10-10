<script setup lang="ts">
import type { TimerViewFeedDto, TimeEntryDto } from '~~/shared/types/time-entry';
import type { ColumnDefinition } from '~/components/ColumnList.vue';

const { t, locale } = useI18n();
const columns = computed(
  () =>
    [
      { key: 'toggle', track: '1.5rem' },
      { key: 'count', track: '1.25rem' },
      { key: 'title', track: { fr: 3, min: '8rem' }, header: t('timerView.columns.task') },
      { key: 'project', track: { fr: 1.2, min: '7rem' }, header: t('timerView.columns.project') },
      { key: 'issue', track: '4.5rem', header: t('timerView.columns.issue') },
      { key: 'duration', track: '5rem', header: t('timerView.columns.duration'), align: 'end' },
      { key: 'action', track: '1.5rem' },
    ] as const satisfies readonly ColumnDefinition[],
);
/** Narrow layout (D5): toggle, count, text, issue, duration, action. */
const narrowColumns = '1.5rem 1.25rem minmax(0,1fr) 4.5rem 5rem 1.5rem';
usePageTitle(() => t('timerView.pageTitle'));
const { running, elapsedSeconds, start, stop, fetchRunning } = useTimer();
const { effective } = useProfile();
const requestFetch = useRequestFetch();

// Lazy: client navigation renders at once with a skeleton (REQ-391); SSR still waits for the feed.
const { data: feedData, status: feedStatus } = await useAsyncData(
  'timer-view-feed',
  () => requestFetch<TimerViewFeedDto>('/api/time-entries/feed'),
  { lazy: true },
);
const feedSettled = computed(() => feedStatus.value === 'success' || feedStatus.value === 'error');

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

/**
 * Remote project scope per project id (REQ-328). Built once per project list so each
 * group receives the same object on every render and does not re-render needlessly.
 */
const scopeByProjectId = computed(() => {
  const scopes = new Map<string, { remoteProjectId: string; remoteProjectTitle: string }>();
  for (const project of projectOptions.value) {
    if (!project.remoteProjectId || !project.remoteProjectTitle) continue;
    scopes.set(project.id, {
      remoteProjectId: project.remoteProjectId,
      remoteProjectTitle: project.remoteProjectTitle,
    });
  }
  return scopes;
});

/** The owning project's remote project scope (REQ-328), or null when unset. */
function scopeForGroup(group: { projectId: string | null }) {
  return (group.projectId && scopeByProjectId.value.get(group.projectId)) || null;
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
 * Re-fetch the whole loaded window in one request (REQ-393): `from` is the start of the
 * oldest loaded day, so the response covers everything shown and keeps pagination in sync.
 * A failed refresh keeps the held entries.
 */
async function refreshLoadedRange() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    const page = await fetchTimerViewFeed(loadedFrom.value ? { from: loadedFrom.value } : {});
    applyFeed(page, 'replace');
  } catch {
    // Keep showing what we have; the next mutation or navigation refreshes again.
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

const days = computed(() => groupTimeEntriesByDay(displayEntries.value, effective.value));

const isNeverTracked = computed(
  () =>
    feedSettled.value &&
    !refreshing.value &&
    entries.value.length === 0 &&
    !running.value &&
    !hasMore.value,
);
const hasEntries = computed(() => days.value.length > 0);
/** Skeleton while the first feed is pending with nothing to show yet (REQ-391). */
const feedLoading = computed(() => !feedSettled.value && entries.value.length === 0);

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

/** Set when a load more fails; stops automatic loading until a manual retry succeeds. */
const loadMoreFailed = ref(false);

async function loadMore() {
  if (!hasMore.value || !nextBefore.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await fetchTimerViewFeed({ before: nextBefore.value });
    applyFeed(page, 'append');
    loadMoreFailed.value = false;
  } catch {
    loadMoreFailed.value = true;
  } finally {
    loadingMore.value = false;
  }
}

// --- Automatic load more (REQ-392) ---
// A sentinel next to the "load more" button reports when the list end nears the viewport.
// Loading repeats while it stays in range, so a short page does not stall the list.
const AUTO_LOAD_ROOT_MARGIN = '600px 0px';
const loadMoreSentinel = useTemplateRef<HTMLElement>('loadMoreSentinel');
const sentinelInRange = ref(false);

watch(loadMoreSentinel, (element, _previous, onCleanup) => {
  sentinelInRange.value = false;
  if (!element || !('IntersectionObserver' in globalThis)) return;
  const observer = new IntersectionObserver(
    (records) => {
      sentinelInRange.value = records.some((record) => record.isIntersecting);
    },
    { rootMargin: AUTO_LOAD_ROOT_MARGIN },
  );
  observer.observe(element);
  onCleanup(() => observer.disconnect());
});

watch([sentinelInRange, loadingMore], ([inRange, busy]) => {
  if (inRange && !busy && !loadMoreFailed.value) void loadMore();
});

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

    <div v-else-if="hasEntries" class="grid min-w-0 gap-6">
      <ColumnList :columns="columns" :narrow="narrowColumns" class="timer-list">
        <template v-for="day in days" :key="day.dayKey">
          <ColumnRow
            :data-testid="`timer-day-${day.dayKey}`"
            class="border-accented pt-6 font-semibold text-highlighted @max-[40rem]/list:pt-5"
          >
            <ColumnCell
              :columns="columns"
              col="toggle"
              to="issue"
              role="rowheader"
              :narrow="{ col: [1, 5], row: 1 }"
              class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"
            >
              <h2 class="min-w-0 truncate">{{ dayHeading(day.dayKey) }}</h2>
              <NuxtLink
                :to="`/sync/${day.dayKey}`"
                class="shrink-0 text-sm text-primary no-underline"
                :data-testid="`timer-day-remote-sync-${day.dayKey}`"
              >
                {{ t('timerView.remoteSyncAction') }}
              </NuxtLink>
            </ColumnCell>
            <ColumnCell
              :columns="columns"
              col="duration"
              align="end"
              :narrow="{ col: [5, 6], row: 1 }"
            >
              <span
                class="font-mono text-sm font-semibold tabular-nums text-highlighted"
                :data-testid="`timer-day-total-${day.dayKey}`"
              >
                {{ formatDuration(day.totalSeconds + liveSeconds(day.liveStartedAt, now)) }}
              </span>
            </ColumnCell>
            <ColumnCell :columns="columns" col="action" :narrow="{ col: [6, 7], row: 1 }" />
          </ColumnRow>
          <TimerTaskGroup
            v-for="group in day.groups"
            :key="group.key"
            :columns="columns"
            :editor-key="`${day.dayKey}:${group.key}`"
            :group="group"
            :is-live="isGroupLive(group)"
            :now="group.liveStartedAt ? now : 0"
            :time-zone="effective.timeZone"
            :active-editor-key="activeEditorKey"
            :project-options="projectOptions"
            :tracker="trackerForGroup(group)"
            :scope="scopeForGroup(group)"
            @editing-started="startGroupEditing(`${day.dayKey}:${group.key}`)"
            @continue="onContinue(group)"
            @stop="onStop"
            @entry-changed="onEntryChanged"
            @entry-deleted="onEntryDeleted"
          />
        </template>
      </ColumnList>

      <div v-if="hasMore" class="flex justify-center">
        <span
          ref="loadMoreSentinel"
          aria-hidden="true"
          data-testid="timer-view-load-more-sentinel"
        />
        <UButton
          :label="t('timerView.loadMore')"
          variant="ghost"
          :loading="loadingMore"
          data-testid="timer-view-load-more"
          @click="loadMore"
        />
      </div>
      <p class="sr-only" aria-live="polite" data-testid="timer-view-load-more-status">
        {{ loadingMore ? t('timerView.loadingMore') : '' }}
      </p>
    </div>

    <div
      v-else-if="feedLoading"
      class="grid gap-6"
      aria-busy="true"
      :aria-label="t('timerView.loading')"
      data-testid="timer-view-loading"
    >
      <ColumnList :columns="columns" :narrow="narrowColumns">
        <ColumnRow v-for="row in 6" :key="row">
          <ColumnCell :columns="columns" col="title" to="project" :narrow="{ col: [3, 5], row: 1 }">
            <USkeleton class="h-6 w-full" />
          </ColumnCell>
          <ColumnCell :columns="columns" col="duration" :narrow="{ col: [5, 6], row: 1 }">
            <USkeleton class="h-6 w-full" />
          </ColumnCell>
        </ColumnRow>
      </ColumnList>
    </div>

    <TimerAddEntryDialog
      v-model:visible="addEntryVisible"
      :time-zone="effective.timeZone"
      @added="onEntryAdded"
    />
  </section>
</template>

<style scoped>
@container list (max-width: 40rem) {
  .timer-list :deep([role='table']) {
    grid-template-columns: 1.5rem 1.25rem repeat(3, minmax(0, 1fr)) 5rem 1.5rem !important;
  }
}
</style>
