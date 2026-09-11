<script setup lang="ts">
export interface ExportDialogIncludedRow {
  taskId: string;
  comment: string;
  toSendSeconds: number;
}

const { open, included, toSendSeconds, isRunning, completedCount, totalCount } = defineProps<{
  open: boolean;
  included: ExportDialogIncludedRow[];
  toSendSeconds: number;
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
  isRunning ? t('remoteSync.exportDialog.titleRunning') : t('remoteSync.exportDialog.titleReview'),
);
</script>

<template>
  <UModal
    v-model:open="dialogOpen"
    :title="title"
    :dismissible="!isRunning"
    :close="!isRunning"
    :ui="{ footer: 'justify-end gap-2' }"
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

        <ul class="m-0 grid gap-2 p-0" data-testid="remote-sync-export-included">
          <li
            v-for="item in included"
            :key="item.taskId"
            class="flex items-center justify-between gap-3 list-none"
            :data-testid="`remote-sync-export-row-${item.taskId}`"
          >
            <span class="min-w-0 text-sm">{{ item.comment }}</span>
            <span class="shrink-0 text-sm tabular-nums">
              {{ formatDuration(item.toSendSeconds) }}
            </span>
          </li>
        </ul>

        <div class="flex justify-between text-sm" data-testid="remote-sync-export-dialog-to-send">
          <span>{{ t('remoteSync.toSendLabel') }}</span>
          <span>{{ formatDuration(toSendSeconds) }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
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
