<script setup lang="ts">
/** One task in the export review: the title it sends, its duration and where it goes. */
export interface ExportDialogIncludedRow {
  taskId: string;
  comment: string;
  toSendSeconds: number;
  /** The destination, shown as a quiet second line: Tracker, issue and activity. */
  trackerName: string | null;
  issueId: string | null;
  activityName: string | null;
}

const {
  open,
  included,
  toSendSeconds,
  notReadyCount = 0,
  isRunning,
  completedCount,
  totalCount,
} = defineProps<{
  open: boolean;
  included: ExportDialogIncludedRow[];
  toSendSeconds: number;
  /** The day's other Tasks that are not ready (Sent ones aside), stated as a count only. */
  notReadyCount?: number;
  isRunning: boolean;
  completedCount: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const { t } = useI18n();

const dialogOpen = computed({
  get: () => open,
  set: (value: boolean) => {
    if (!value && isRunning) return;
    emit('update:open', value);
    if (!value) emit('cancel');
  },
});

const title = computed(() =>
  isRunning
    ? t('remoteSync.exportDialog.titleRunning')
    : t('remoteSync.exportDialog.titleReview', { count: included.length }, included.length),
);

function destinationOf(item: ExportDialogIncludedRow): string {
  return [item.trackerName, item.issueId && `#${item.issueId}`, item.activityName]
    .filter((part): part is string => !!part)
    .join(' · ');
}
</script>

<template>
  <UModal
    v-model:open="dialogOpen"
    :title="title"
    :dismissible="!isRunning"
    :close="!isRunning"
    data-testid="remote-sync-export-dialog"
  >
    <template #body>
      <div class="grid gap-4" data-testid="remote-sync-export-dialog-body">
        <div
          v-if="isRunning"
          role="status"
          aria-live="polite"
          class="text-sm font-medium"
          data-testid="remote-sync-export-progress"
        >
          {{
            t(
              'remoteSync.exportDialog.progress',
              { completed: completedCount, total: totalCount },
              totalCount,
            )
          }}
        </div>

        <!-- Each task: the title to send with its duration, the destination quietly below. -->
        <ul class="m-0 grid gap-3 p-0" data-testid="remote-sync-export-included">
          <li
            v-for="item in included"
            :key="item.taskId"
            class="grid list-none grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5"
            :data-testid="`remote-sync-export-row-${item.taskId}`"
          >
            <span class="min-w-0 truncate text-sm font-medium text-highlighted">
              {{ item.comment }}
            </span>
            <span class="font-mono text-sm tabular-nums text-default">
              {{ formatDuration(item.toSendSeconds) }}
            </span>
            <span
              v-if="destinationOf(item)"
              class="col-span-2 min-w-0 truncate text-xs text-muted"
              :data-testid="`remote-sync-export-destination-${item.taskId}`"
            >
              {{ destinationOf(item) }}
            </span>
          </li>
        </ul>

        <div
          class="flex items-baseline justify-between border-t border-default pt-3 text-highlighted"
          data-testid="remote-sync-export-dialog-to-send"
        >
          <span class="text-sm font-semibold">{{ t('remoteSync.toSendLabel') }}</span>
          <span class="font-mono text-base font-semibold tabular-nums">
            {{ formatDuration(toSendSeconds) }}
          </span>
        </div>

        <!-- REQ-229: the rows themselves say why; the review only counts them. -->
        <p
          v-if="notReadyCount > 0 && !isRunning"
          class="m-0 flex items-center gap-1.5 text-xs text-muted"
          data-testid="remote-sync-export-not-ready"
        >
          <UIcon name="i-lucide-info" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
          {{ t('remoteSync.exportDialog.notReady', { count: notReadyCount }, notReadyCount) }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :disabled="isRunning"
          :label="t('remoteSync.exportDialog.cancel')"
          data-testid="remote-sync-export-cancel"
          @click="dialogOpen = false"
        />
        <UButton
          color="primary"
          :loading="isRunning"
          :label="t('remoteSync.exportDialog.confirm')"
          data-testid="remote-sync-export-confirm"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
