<script setup lang="ts">
import {
  EXTENSION_ERROR_MESSAGE_KEYS,
  type DestinationSelector,
} from '@osi/time-tracker-extension-protocol';
import type {
  RemoteSyncDayEntryDto,
  RemoteSyncExportProvenanceDto,
} from '~~/shared/types/remote-sync-day';
import type { RemoteTimeLogDto } from '@osi/time-tracker-remote-trackers/contracts';
import type { ColumnDefinition } from '../ColumnList.vue';

const {
  columns = [
    { key: 'expand', track: '1.5rem' },
    { key: 'state', track: '1.5rem' },
    { key: 'title', track: '8rem' },
    { key: 'issue', track: '6rem' },
    { key: 'activity', track: '6rem' },
    { key: 'tracked', track: '5rem' },
    { key: 'toSend', track: '6rem' },
    { key: 'actions', track: '1.5rem' },
  ],
  taskId,
  entries,
  exportRecords,
  trackerId,
  trackerDestination = null,
  showRemoteLogs,
  remoteLogs,
  remoteLogsLoading,
  remoteLogsErrorKey,
  remoteLogsLoaded,
  canReconcile,
  busy,
  formatEntryStart,
  formatEntryStop,
} = defineProps<{
  columns?: readonly ColumnDefinition[];
  taskId: string;
  entries: RemoteSyncDayEntryDto[];
  exportRecords: RemoteSyncExportProvenanceDto[];
  trackerId: string | null;
  /** Provider and base URL of the row's tracker, for asking the extension to approve it. */
  trackerDestination?: DestinationSelector | null;
  showRemoteLogs: boolean;
  remoteLogs: RemoteTimeLogDto[];
  remoteLogsLoading: boolean;
  remoteLogsErrorKey: string | null;
  remoteLogsLoaded: boolean;
  canReconcile: boolean;
  busy: boolean;
  formatEntryStart: (iso: string) => string;
  formatEntryStop: (iso: string) => string;
}>();

const emit = defineEmits<{
  retryRemoteLogs: [];
  link: [log: RemoteTimeLogDto];
  delete: [log: RemoteTimeLogDto, exportId: string];
}>();

const { t } = useI18n();
const extensionLogsErrorKey = computed(() =>
  Object.values(EXTENSION_ERROR_MESSAGE_KEYS).find((key) => key === remoteLogsErrorKey),
);
const unapprovedDestination = computed(() =>
  extensionLogsErrorKey.value === EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved
    ? trackerDestination
    : null,
);
const suggestion = useExtensionSuggestion(() => emit('retryRemoteLogs'));

function commentText(log: RemoteTimeLogDto): string {
  const comment = log.comment?.trim();
  return comment && comment.length > 0 ? comment : t('remoteSync.remoteLogNoComment');
}

function linkedExport(log: RemoteTimeLogDto): RemoteSyncExportProvenanceDto | undefined {
  if (!trackerId) return undefined;
  return exportRecords.find(
    (record) => record.trackerId === trackerId && record.remoteLogId === log.remoteLogId,
  );
}

function isLinked(log: RemoteTimeLogDto): boolean {
  return !!linkedExport(log);
}

/** The log's link state with what it means for this task, for the tooltip and assistive tech. */
function linkStateText(log: RemoteTimeLogDto): string {
  return isLinked(log)
    ? t('remoteSync.remoteLogLinkedHint')
    : t('remoteSync.remoteLogUnlinkedHint');
}

function emitDelete(log: RemoteTimeLogDto) {
  const record = linkedExport(log);
  if (!record) return;
  emit('delete', log, record.exportId);
}

const hasFinalizedExport = computed(() => exportRecords.length > 0);

function logFromProvenance(record: RemoteSyncExportProvenanceDto): RemoteTimeLogDto {
  return {
    remoteLogId: record.remoteLogId,
    remoteIssueId: record.remoteIssueId,
    spentOn: '',
    durationSeconds: record.exportDurationSeconds,
    activityId: record.requiredFieldValues.activity ?? null,
    activityName: null,
    comment: null,
    remoteUserId: null,
    // The tracker did not return this log, so its issue title is not known here.
    remoteIssueTitle: null,
  };
}

/** Local provenance with no matching tracker log still needs Delete (orphan / stale cache). */
const displayedRemoteLogs = computed(() => {
  if (!remoteLogsLoaded || remoteLogsErrorKey) return remoteLogs;
  const known = new Set(remoteLogs.map((log) => log.remoteLogId));
  const missing = exportRecords
    .filter(
      (record) => (!trackerId || record.trackerId === trackerId) && !known.has(record.remoteLogId),
    )
    .map(logFromProvenance);
  return [...remoteLogs, ...missing];
});
</script>

<template>
  <ColumnDetail :id="`remote-sync-detail-${taskId}`" :data-testid="`remote-sync-detail-${taskId}`">
    <ColumnRow kind="label">
      <ColumnCell
        :columns="columns"
        col="title"
        to="actions"
        :narrow="{ col: [3, 6], row: 1 }"
        :data-testid="`remote-sync-entries-${taskId}`"
      >
        {{ t('remoteSync.entriesHeading') }}
      </ColumnCell>
    </ColumnRow>
    <ColumnRow
      v-for="entry in entries"
      :key="entry.id"
      kind="sub"
      :data-testid="`remote-sync-entry-${entry.id}`"
    >
      <!-- Placed like the Timer's entry times: right-aligned in the column before the duration,
           small tabular figures with a spaced separator. -->
      <ColumnCell
        :columns="columns"
        col="activity"
        :narrow="{ col: [3, 4], row: 1 }"
        align="end"
        class="text-xs font-medium tabular-nums text-default"
      >
        {{ formatEntryStart(entry.startedAt) }}
        <span class="px-0.5">{{ t('timerView.entryRow.separator') }}</span>
        {{ formatEntryStop(entry.stoppedAt) }}
      </ColumnCell>
      <ColumnCell
        :columns="columns"
        col="tracked"
        :narrow="{ col: [4, 5], row: 1 }"
        align="end"
        class="font-mono tabular-nums"
      >
        {{ formatDuration(entry.durationSeconds) }}
      </ColumnCell>
    </ColumnRow>
    <template v-if="showRemoteLogs">
      <ColumnRow kind="label" :data-testid="`remote-sync-remote-logs-${taskId}`">
        <ColumnCell :columns="columns" col="title" to="actions" :narrow="{ col: [3, 6], row: 1 }">
          {{ t('remoteSync.remoteLogsHeading') }}
        </ColumnCell>
      </ColumnRow>
      <ColumnRow v-if="remoteLogsLoading" kind="sub">
        <ColumnCell
          :columns="columns"
          col="title"
          to="actions"
          :narrow="{ col: [3, 6], row: 1 }"
          class="flex items-center gap-1.5 text-xs"
          role="status"
          aria-live="polite"
          :data-testid="`remote-sync-remote-logs-loading-${taskId}`"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-3.5 shrink-0 animate-spin text-dimmed"
            aria-hidden="true"
          />
          {{ t('remoteSync.remoteLogsLoading') }}
        </ColumnCell>
      </ColumnRow>
      <ColumnRow v-else-if="remoteLogsErrorKey" kind="sub">
        <ColumnCell
          :columns="columns"
          col="title"
          to="actions"
          :narrow="{ col: [3, 6], row: 1 }"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        >
          <span
            class="inline-flex items-center gap-1.5"
            role="alert"
            :data-testid="`remote-sync-remote-logs-error-${taskId}`"
          >
            <UIcon
              name="i-lucide-circle-alert"
              class="size-3.5 shrink-0 text-error"
              aria-hidden="true"
            />
            {{ t(extensionLogsErrorKey ?? 'remoteSync.remoteLogsError') }}
          </span>
          <span v-if="extensionLogsErrorKey">{{ t('trackers.extensionSetupGuidance') }}</span>
          <UButton
            variant="link"
            size="xs"
            class="p-0"
            :label="
              t(
                extensionLogsErrorKey
                  ? 'trackers.extensionRecheckButton'
                  : 'remoteSync.remoteLogsRetry',
              )
            "
            :data-testid="`remote-sync-remote-logs-retry-${taskId}`"
            @click="emit('retryRemoteLogs')"
          />
          <ExtensionApprovalRequest
            v-if="unapprovedDestination"
            :state="suggestion.states.value[suggestionKey(unapprovedDestination)]"
            :test-id="`remote-sync-remote-logs-request-${taskId}`"
            @request="suggestion.request(unapprovedDestination)"
          />
        </ColumnCell>
      </ColumnRow>
      <ColumnRow v-else-if="remoteLogsLoaded && displayedRemoteLogs.length === 0" kind="sub">
        <ColumnCell
          :columns="columns"
          col="title"
          to="actions"
          :narrow="{ col: [3, 6], row: 1 }"
          class="text-xs"
          :data-testid="`remote-sync-remote-logs-empty-${taskId}`"
        >
          {{ t('remoteSync.remoteLogsEmpty') }}
        </ColumnCell>
      </ColumnRow>
      <ColumnRow
        v-for="log in !remoteLogsLoading && !remoteLogsErrorKey ? displayedRemoteLogs : []"
        :key="log.remoteLogId"
        kind="sub"
        :data-testid="`remote-sync-remote-log-${log.remoteLogId}`"
      >
        <ColumnCell :columns="columns" col="state" :narrow="{ col: [2, 3], row: 1 }">
          <!-- Linked: a check on the tracker's time. Unlinked: an open circle, so it never
               reads as the opposite of the Link action at the row's end. -->
          <UTooltip :text="linkStateText(log)" :content="{ side: 'top' }">
            <span
              tabindex="0"
              class="inline-flex size-6 items-center justify-center"
              :data-testid="`remote-sync-remote-log-state-${log.remoteLogId}`"
            >
              <UIcon
                :name="isLinked(log) ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
                class="size-4"
                :class="isLinked(log) ? 'text-success' : 'text-dimmed'"
                aria-hidden="true"
              />
              <span class="sr-only">{{ linkStateText(log) }}</span>
            </span>
          </UTooltip>
        </ColumnCell>
        <!-- The log's ref sits in the Issue column, under the issue it was logged on. -->
        <ColumnCell
          :columns="columns"
          col="issue"
          :narrow="{ col: [3, 4], row: 1 }"
          class="flex min-w-0 items-baseline gap-1.5"
        >
          <span class="shrink-0 font-mono text-xs tabular-nums text-dimmed">
            {{ `#${log.remoteLogId}` }}
          </span>
          <OverflowTooltip :text="commentText(log)">
            <span
              class="block min-w-0 truncate"
              :aria-label="commentText(log)"
              :data-testid="`remote-sync-remote-log-comment-${log.remoteLogId}`"
            >
              {{ commentText(log) }}
            </span>
          </OverflowTooltip>
        </ColumnCell>
        <ColumnCell
          :columns="columns"
          col="activity"
          :narrow="{ col: [3, 4], row: 2 }"
          class="truncate"
        >
          {{ log.activityName ?? t('remoteSync.emptyCell') }}
        </ColumnCell>
        <!-- Time already in the tracker sits on the to-send edge (REQ-507). A scope label right
             above the value, and the muted body weight, keep it from reading as time still to
             send. The cell's accessible name carries the scope. -->
        <ColumnCell
          :columns="columns"
          col="toSend"
          :narrow="{ col: [4, 5], row: 1 }"
          align="end"
          class="grid py-0.5"
          :aria-label="`${t('remoteSync.remoteLogDurationLabel')}: ${formatDuration(log.durationSeconds)}`"
        >
          <span
            class="truncate text-[11px]/3 text-dimmed"
            aria-hidden="true"
            :data-testid="`remote-sync-remote-log-scope-${log.remoteLogId}`"
          >
            {{ t('remoteSync.inTrackerLogs') }}
          </span>
          <span class="font-mono font-normal tabular-nums text-muted">
            {{ formatDuration(log.durationSeconds) }}
          </span>
        </ColumnCell>
        <ColumnCell :columns="columns" col="actions" :narrow="{ col: [5, 6], row: 1 }">
          <UTooltip
            v-if="canReconcile && !isLinked(log) && !hasFinalizedExport"
            :text="t('remoteSync.linkRemoteEntry')"
            :content="{ side: 'top' }"
          >
            <UButton
              icon="i-lucide-link"
              color="neutral"
              variant="ghost"
              square
              size="xs"
              class="text-muted"
              :disabled="busy"
              :aria-label="t('remoteSync.linkRemoteEntry')"
              :data-testid="`remote-sync-link-entry-${log.remoteLogId}`"
              @click="emit('link', log)"
            />
          </UTooltip>
          <UTooltip
            v-if="canReconcile && isLinked(log) && linkedExport(log)"
            :text="t('remoteSync.deleteRemoteEntry')"
            :content="{ side: 'top' }"
          >
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              square
              size="xs"
              class="text-muted hover:bg-error/10 hover:text-error focus-visible:text-error"
              :disabled="busy"
              :aria-label="t('remoteSync.deleteRemoteEntry')"
              :data-testid="`remote-sync-delete-entry-${log.remoteLogId}`"
              @click="emitDelete(log)"
            />
          </UTooltip>
        </ColumnCell>
      </ColumnRow>
    </template>
  </ColumnDetail>
</template>
