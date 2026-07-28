<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RemoteExportTaskOutcomeDto } from '~~/shared/types/remote-export';
import type { RemoteSyncDayRowDto } from '~~/shared/types/remote-sync-day';
import type { SyncExportProgressStatus } from '~/composables/useSyncExport';
import { formatDuration } from '~/utils/formatDuration';

export type ExportDialogPhase = 'review' | 'running' | 'report';

export interface ExportDialogIncludedRow {
  taskId: string;
  taskName: string;
  issueLabel: string;
  activityLabel: string;
  trackedSeconds: number;
  toSendSeconds: number;
  comment: string;
  isRepeat: boolean;
  isDuplicate: boolean;
  baseUrl: string | null;
  row: RemoteSyncDayRowDto;
}

export interface ExportDialogSkippedRow {
  taskId: string;
  taskName: string;
  reason: string;
}

const props = defineProps<{
  open: boolean;
  phase: ExportDialogPhase;
  included: ExportDialogIncludedRow[];
  skipped: ExportDialogSkippedRow[];
  dayTotalSeconds: number;
  trackedSeconds: number;
  toSendSeconds: number;
  progress: Record<string, SyncExportProgressStatus>;
  outcomes: Record<string, RemoteExportTaskOutcomeDto>;
  completedCount: number;
  totalCount: number;
  isRunning: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
  cancel: [];
  stop: [];
  close: [];
  retry: [taskId: string];
}>();

const { t } = useI18n();

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => {
    if (!value && props.phase === 'running') return;
    emit('update:open', value);
    if (!value && props.phase === 'report') emit('close');
    if (!value && props.phase === 'review') emit('cancel');
  },
});

const title = computed(() => {
  switch (props.phase) {
    case 'running':
      return t('remoteSync.exportDialog.titleRunning');
    case 'report':
      return t('remoteSync.exportDialog.titleReport');
    default:
      return t('remoteSync.exportDialog.titleReview');
  }
});

function statusLabel(status: SyncExportProgressStatus | undefined): string {
  switch (status) {
    case 'creating':
      return t('remoteSync.exportDialog.statusCreating');
    case 'finalizing':
      return t('remoteSync.exportDialog.statusFinalizing');
    case 'done':
      return t('remoteSync.exportDialog.statusDone');
    case 'failed':
      return t('remoteSync.exportDialog.statusFailed');
    case 'uncertain':
      return t('remoteSync.exportDialog.statusUncertain');
    case 'not_attempted':
      return t('remoteSync.exportDialog.statusNotAttempted');
    case 'queued':
    default:
      return t('remoteSync.exportDialog.statusQueued');
  }
}

function outcomeText(taskId: string): string | null {
  const outcome = props.outcomes[taskId];
  if (!outcome?.messageKey) return null;
  return t(outcome.messageKey, outcome.messageParams ?? {});
}

function remoteLogHref(baseUrl: string | null, remoteLogId: string | undefined): string | null {
  if (!baseUrl || !remoteLogId) return null;
  const root = baseUrl.replace(/\/+$/, '');
  return `${root}/time_entries/${encodeURIComponent(remoteLogId)}`;
}

const succeeded = computed(() =>
  props.included.filter((row) => props.progress[row.taskId] === 'done'),
);
const failed = computed(() =>
  props.included.filter((row) => props.progress[row.taskId] === 'failed'),
);
const uncertain = computed(() =>
  props.included.filter((row) => props.progress[row.taskId] === 'uncertain'),
);
const notAttempted = computed(() =>
  props.included.filter((row) => props.progress[row.taskId] === 'not_attempted'),
);
const inProgress = computed(() =>
  props.included.filter((row) => {
    const status = props.progress[row.taskId];
    return status === 'queued' || status === 'creating' || status === 'finalizing';
  }),
);
</script>

<template>
  <UModal
    v-model:open="dialogOpen"
    :title="title"
    :dismissible="phase !== 'running'"
    :close="phase !== 'running'"
    data-testid="remote-sync-export-dialog"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="grid gap-4" data-testid="remote-sync-export-dialog-body">
        <div
          class="flex flex-wrap gap-3 font-mono text-sm"
          data-testid="remote-sync-export-dialog-summaries"
        >
          <span data-testid="remote-sync-export-dialog-day-total">
            {{ t('remoteSync.dayTotalLabel') }}: {{ formatDuration(dayTotalSeconds) }}
          </span>
          <span data-testid="remote-sync-export-dialog-tracked">
            {{ t('remoteSync.trackedLabel') }}: {{ formatDuration(trackedSeconds) }}
          </span>
          <span data-testid="remote-sync-export-dialog-to-send">
            {{ t('remoteSync.toSendLabel') }}: {{ formatDuration(toSendSeconds) }}
          </span>
        </div>

        <div
          v-if="phase === 'running'"
          role="status"
          aria-live="polite"
          class="text-sm font-medium"
          data-testid="remote-sync-export-progress"
        >
          {{
            t('remoteSync.exportDialog.progress', {
              completed: completedCount,
              total: totalCount,
            })
          }}
        </div>

        <template v-if="phase === 'review' || phase === 'running'">
          <div data-testid="remote-sync-export-included">
            <h3 class="mb-2 font-semibold">{{ t('remoteSync.exportDialog.includedHeading') }}</h3>
            <ul class="m-0 grid gap-3 p-0">
              <li
                v-for="item in included"
                :key="item.taskId"
                class="grid gap-1 list-none rounded-md border border-default p-3"
                :data-testid="`remote-sync-export-row-${item.taskId}`"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold">{{ item.taskName }}</span>
                  <UBadge
                    v-if="item.isRepeat"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    :label="t('remoteSync.exportDialog.repeatBadge')"
                    :data-testid="`remote-sync-export-repeat-${item.taskId}`"
                  />
                  <UBadge
                    v-if="item.isDuplicate"
                    color="warning"
                    variant="outline"
                    size="sm"
                    :label="t('remoteSync.exportDialog.duplicateBadge')"
                    :data-testid="`remote-sync-export-duplicate-${item.taskId}`"
                  />
                </div>
                <div class="text-sm text-muted">
                  {{ item.issueLabel }} {{ t('remoteSync.emptyCell') }} {{ item.activityLabel }}
                </div>
                <div class="font-mono text-sm">
                  {{
                    t('remoteSync.trackedToSend', {
                      tracked: formatDuration(item.trackedSeconds),
                      toSend: formatDuration(item.toSendSeconds),
                    })
                  }}
                </div>
                <div class="text-sm" :data-testid="`remote-sync-export-comment-${item.taskId}`">
                  {{ t('remoteSync.exportDialog.columnComment') }}: {{ item.comment }}
                </div>
                <div
                  v-if="phase === 'running'"
                  class="text-sm"
                  :data-testid="`remote-sync-export-status-${item.taskId}`"
                >
                  {{ statusLabel(progress[item.taskId]) }}
                </div>
              </li>
            </ul>
          </div>

          <div v-if="skipped.length > 0" data-testid="remote-sync-export-skipped">
            <h3 class="mb-2 font-semibold">{{ t('remoteSync.exportDialog.skippedHeading') }}</h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in skipped"
                :key="item.taskId"
                class="list-none text-sm text-muted"
                :data-testid="`remote-sync-export-skipped-${item.taskId}`"
              >
                <span class="font-medium text-default">{{ item.taskName }}</span>
                {{ t('remoteSync.emptyCell') }} {{ item.reason }}
              </li>
            </ul>
          </div>
        </template>

        <template v-else>
          <section v-if="inProgress.length" data-testid="remote-sync-export-group-in-progress">
            <h3 class="mb-2 font-semibold">
              {{ t('remoteSync.exportDialog.groupInProgress') }}
            </h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in inProgress"
                :key="item.taskId"
                class="list-none rounded-md border border-default p-2 text-sm"
                :data-testid="`remote-sync-export-result-${item.taskId}`"
              >
                <span class="font-semibold">{{ item.taskName }}</span>
                {{ t('remoteSync.emptyCell') }} {{ statusLabel(progress[item.taskId]) }}
              </li>
            </ul>
          </section>

          <section v-if="succeeded.length" data-testid="remote-sync-export-group-succeeded">
            <h3 class="mb-2 font-semibold text-success">
              {{ t('remoteSync.exportDialog.groupSucceeded') }}
            </h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in succeeded"
                :key="item.taskId"
                class="list-none rounded-md border border-success/30 p-2 text-sm"
                :data-testid="`remote-sync-export-result-${item.taskId}`"
              >
                <span class="font-semibold">{{ item.taskName }}</span>
                {{ t('remoteSync.emptyCell') }} {{ outcomeText(item.taskId) }}
              </li>
            </ul>
          </section>

          <section v-if="failed.length" data-testid="remote-sync-export-group-failed">
            <h3 class="mb-2 font-semibold text-error">
              {{ t('remoteSync.exportDialog.groupFailed') }}
            </h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in failed"
                :key="item.taskId"
                class="list-none rounded-md border border-error/30 p-2 text-sm"
                :data-testid="`remote-sync-export-result-${item.taskId}`"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span class="font-semibold">{{ item.taskName }}</span>
                    {{ t('remoteSync.emptyCell') }} {{ outcomeText(item.taskId) }}
                  </span>
                  <UButton
                    size="xs"
                    variant="soft"
                    :label="t('remoteSync.exportDialog.retry')"
                    :disabled="isRunning"
                    :data-testid="`remote-sync-export-retry-${item.taskId}`"
                    @click="emit('retry', item.taskId)"
                  />
                </div>
              </li>
            </ul>
          </section>

          <section v-if="uncertain.length" data-testid="remote-sync-export-group-uncertain">
            <h3 class="mb-2 flex items-center gap-2 font-semibold text-warning">
              <UIcon name="i-lucide-triangle-alert" class="size-4" />
              {{ t('remoteSync.exportDialog.groupUncertain') }}
            </h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in uncertain"
                :key="item.taskId"
                class="list-none rounded-md border border-warning/40 bg-warning/10 p-2 text-sm"
                :data-testid="`remote-sync-export-result-${item.taskId}`"
              >
                <div class="grid gap-1">
                  <span class="font-semibold">{{ item.taskName }}</span>
                  <span>
                    {{
                      t('remoteSync.exportDialog.uncertainHint', {
                        id: outcomes[item.taskId]?.remoteLogId ?? t('remoteSync.emptyCell'),
                      })
                    }}
                  </span>
                  <a
                    v-if="remoteLogHref(item.baseUrl, outcomes[item.taskId]?.remoteLogId)"
                    class="text-primary underline"
                    :href="remoteLogHref(item.baseUrl, outcomes[item.taskId]?.remoteLogId)!"
                    target="_blank"
                    rel="noopener noreferrer"
                    :data-testid="`remote-sync-export-log-link-${item.taskId}`"
                  >
                    {{
                      t('remoteSync.exportDialog.remoteLogLink', {
                        id: outcomes[item.taskId]?.remoteLogId,
                      })
                    }}
                  </a>
                  <div>
                    <UButton
                      size="xs"
                      variant="soft"
                      color="warning"
                      :label="t('remoteSync.exportDialog.retry')"
                      :disabled="isRunning"
                      :data-testid="`remote-sync-export-retry-${item.taskId}`"
                      @click="emit('retry', item.taskId)"
                    />
                  </div>
                </div>
              </li>
            </ul>
          </section>

          <section v-if="notAttempted.length" data-testid="remote-sync-export-group-not-attempted">
            <h3 class="mb-2 font-semibold">
              {{ t('remoteSync.exportDialog.groupNotAttempted') }}
            </h3>
            <ul class="m-0 grid gap-2 p-0">
              <li
                v-for="item in notAttempted"
                :key="item.taskId"
                class="list-none text-sm text-muted"
                :data-testid="`remote-sync-export-result-${item.taskId}`"
              >
                {{ item.taskName }} {{ t('remoteSync.emptyCell') }}
                {{ t('remoteSync.exportNotAttempted') }}
              </li>
            </ul>
          </section>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-2" data-testid="remote-sync-export-dialog-footer">
        <template v-if="phase === 'review'">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('remoteSync.exportDialog.cancel')"
            data-testid="remote-sync-export-cancel"
            @click="emit('cancel')"
          />
          <UButton
            :label="t('remoteSync.exportDialog.confirm')"
            data-testid="remote-sync-export-confirm"
            :disabled="included.length === 0"
            @click="emit('confirm')"
          />
        </template>
        <template v-else-if="phase === 'running'">
          <UButton
            color="neutral"
            variant="soft"
            :label="t('remoteSync.exportDialog.stop')"
            data-testid="remote-sync-export-stop"
            @click="emit('stop')"
          />
        </template>
        <template v-else>
          <UButton
            :label="t('remoteSync.exportDialog.close')"
            data-testid="remote-sync-export-close"
            @click="emit('close')"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
