<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';

const { open, tracker } = defineProps<{
  open: boolean;
  tracker: TrackerDto;
}>();

const emit = defineEmits<{ 'update:open': [boolean] }>();

const { t } = useI18n();
const { $csrfFetch } = useNuxtApp();
const { effective } = useUserSettings();
const requestFetch = useRequestFetch();

const dialogOpen = computed({
  get: () => open,
  set: (value: boolean) => emit('update:open', value),
});

const projects = ref<ProjectDto[]>([]);
const projectsLoaded = ref(false);
const fromDate = ref('');
const toDate = ref('');
const rangeError = ref('');

function defaultRange() {
  const today = localDayKeyFromInstant(new Date().toISOString(), effective.value.timeZone);
  const fiveYearsAgo = Temporal.PlainDate.from(today).subtract({ years: 5 }).toString();
  fromDate.value = fiveYearsAgo;
  toDate.value = today;
}

async function importLogs(body: ImportRemoteLogsDto): Promise<ImportRemoteLogsResultDto> {
  return $csrfFetch<ImportRemoteLogsResultDto>(`/api/trackers/${tracker.id}/import`, {
    method: 'POST',
    body,
  });
}

const importState = useRemoteLogImport({
  config: tracker,
  get projects() {
    return projects.value;
  },
  importLogs,
});
const { phase, scannedMonths, importedMonths, totalMonths, preview, missingProjectIdHint } =
  importState;
const { hasNothingToImport, result, errorState } = importState;

const scopedProjects = computed(() => projects.value.filter((p) => p.remoteProjectId));
const unscopedProjects = computed(() => projects.value.filter((p) => !p.remoteProjectId));

function projectName(projectId: string): string {
  return projects.value.find((p) => p.id === projectId)?.name ?? projectId;
}

interface PreviewRow {
  key: string;
  remoteProjectTitle: string | null;
  localProjectName: string | null;
  wouldImport: number;
  skippedExisting: number | null;
}

const previewRows = computed<PreviewRow[]>(() => [
  ...preview.value.matched.map((row): PreviewRow => ({
    key: `matched-${row.projectId}`,
    remoteProjectTitle:
      row.remoteProjectTitles.length > 0 ? row.remoteProjectTitles.join(', ') : null,
    localProjectName: projectName(row.projectId),
    wouldImport: row.wouldImport,
    skippedExisting: row.skippedExisting,
  })),
  ...preview.value.unmatched.map((row): PreviewRow => ({
    key: `unmatched-${row.remoteProjectId ?? 'none'}`,
    remoteProjectTitle:
      row.remoteProjectTitle ?? row.remoteProjectId ?? t('trackerImport.unknownRemoteProject'),
    localProjectName: null,
    wouldImport: row.count,
    skippedExisting: null,
  })),
]);

const totalWouldImport = computed(() =>
  preview.value.matched.reduce((sum, row) => sum + row.wouldImport, 0),
);
const totalSkippedExisting = computed(() =>
  preview.value.matched.reduce((sum, row) => sum + row.skippedExisting, 0),
);
const totalUnmatched = computed(() =>
  preview.value.unmatched.reduce((sum, row) => sum + row.count, 0),
);

async function loadProjects() {
  projectsLoaded.value = false;
  projects.value = await requestFetch<ProjectDto[]>('/api/projects', {
    query: { trackerId: tracker.id },
  });
  projectsLoaded.value = true;
}

watch(
  () => open,
  (isOpen) => {
    if (!isOpen) return;
    importState.reset();
    defaultRange();
    rangeError.value = '';
    void loadProjects();
  },
  // The page mounts this dialog via `v-if` only once a tracker is chosen, so
  // it is created already `open: true` — a plain (non-immediate) watch would
  // never see a false->true transition to seed the form on first open.
  { immediate: true },
);

function submitRange() {
  rangeError.value = '';
  if (!fromDate.value || !toDate.value) {
    rangeError.value = t('trackerImport.rangeRequired');
    return;
  }
  if (Temporal.PlainDate.compare(fromDate.value, toDate.value) > 0) {
    rangeError.value = t('trackerImport.rangeInverted');
    return;
  }
  void importState.startScan({ from: fromDate.value, to: toDate.value });
}

function confirmImport() {
  void importState.startImport();
}

function backToRange() {
  importState.reset();
  defaultRange();
}

function closeDialog() {
  dialogOpen.value = false;
}
</script>

<template>
  <UModal
    v-model:open="dialogOpen"
    :title="t('trackerImport.dialogTitle', { name: tracker.name })"
    :dismissible="phase !== 'scanning' && phase !== 'importing'"
    :close="phase !== 'scanning' && phase !== 'importing'"
    :ui="{ content: 'sm:max-w-lg' }"
    data-testid="tracker-import-dialog"
  >
    <template #body>
      <div class="grid gap-4" data-testid="tracker-import-dialog-body">
        <!-- Range phase -->
        <div v-if="phase === 'range'" class="grid gap-3" data-testid="tracker-import-range">
          <p class="text-sm text-muted">{{ t('trackerImport.description') }}</p>

          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1">
              <label for="tracker-import-from">{{ t('trackerImport.fromLabel') }}</label>
              <UInput
                id="tracker-import-from"
                v-model="fromDate"
                type="date"
                data-testid="tracker-import-from-input"
              />
            </div>
            <div class="grid gap-1">
              <label for="tracker-import-to">{{ t('trackerImport.toLabel') }}</label>
              <UInput
                id="tracker-import-to"
                v-model="toDate"
                type="date"
                data-testid="tracker-import-to-input"
              />
            </div>
          </div>

          <p
            v-if="rangeError"
            id="tracker-import-range-error"
            class="m-0 text-sm text-error"
            role="alert"
            data-testid="tracker-import-range-error"
          >
            {{ rangeError }}
          </p>

          <div v-if="projectsLoaded" class="grid gap-1" data-testid="tracker-import-project-scopes">
            <p class="m-0 text-sm font-medium">{{ t('trackerImport.scopedProjectsHeading') }}</p>
            <ul class="m-0 grid gap-0.5 p-0 text-sm">
              <li
                v-for="project in scopedProjects"
                :key="project.id"
                class="flex justify-between gap-2 list-none"
              >
                <span>{{ project.name }}</span>
                <span class="text-muted">{{ project.remoteProjectTitle }}</span>
              </li>
              <li
                v-for="project in unscopedProjects"
                :key="project.id"
                class="flex justify-between gap-2 list-none"
                :data-testid="`tracker-import-unscoped-${project.id}`"
              >
                <span>{{ project.name }}</span>
                <span class="text-muted">{{ t('trackerImport.unscopedHint') }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Scanning phase -->
        <div
          v-else-if="phase === 'scanning'"
          class="grid gap-2"
          data-testid="tracker-import-scanning"
        >
          <div role="status" aria-live="polite" class="text-sm font-medium">
            {{
              t('trackerImport.scanningProgress', { completed: scannedMonths, total: totalMonths })
            }}
          </div>
          <UProgress :model-value="scannedMonths" :max="totalMonths || 1" />
        </div>

        <!-- Preview phase -->
        <div
          v-else-if="phase === 'preview'"
          class="grid gap-3"
          data-testid="tracker-import-preview"
        >
          <table class="w-full text-sm" data-testid="tracker-import-preview-table">
            <thead>
              <tr class="text-left text-muted">
                <th scope="col">{{ t('trackerImport.columnRemoteProject') }}</th>
                <th scope="col">{{ t('trackerImport.columnLocalProject') }}</th>
                <th scope="col" class="text-end">{{ t('trackerImport.columnNew') }}</th>
                <th scope="col" class="text-end">{{ t('trackerImport.columnLinked') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in previewRows"
                :key="row.key"
                :data-testid="`tracker-import-row-${row.key}`"
              >
                <td>{{ row.remoteProjectTitle ?? '—' }}</td>
                <td>
                  <span v-if="row.localProjectName">{{ row.localProjectName }}</span>
                  <span v-else class="text-warning">{{ t('trackerImport.noScopedProject') }}</span>
                </td>
                <td class="text-end tabular-nums">{{ row.wouldImport }}</td>
                <td class="text-end tabular-nums">{{ row.skippedExisting ?? '—' }}</td>
              </tr>
            </tbody>
          </table>

          <div
            class="flex justify-between text-sm font-medium"
            data-testid="tracker-import-preview-totals"
          >
            <span>{{ t('trackerImport.totalLabel') }}</span>
            <span>
              {{
                t('trackerImport.totalCounts', {
                  new: totalWouldImport,
                  linked: totalSkippedExisting,
                })
              }}
            </span>
          </div>

          <p
            v-if="totalUnmatched > 0"
            role="status"
            class="m-0 text-sm text-warning"
            data-testid="tracker-import-unmatched-hint"
          >
            {{ t('trackerImport.unmatchedHint', { count: totalUnmatched }) }}
          </p>

          <p
            v-if="missingProjectIdHint"
            role="status"
            class="m-0 text-sm text-warning"
            data-testid="tracker-import-missing-project-id-hint"
          >
            {{ t('trackerImport.missingProjectIdHint') }}
          </p>

          <p
            v-if="hasNothingToImport"
            class="m-0 text-sm text-muted"
            data-testid="tracker-import-nothing-to-import"
          >
            {{ t('trackerImport.nothingToImport') }}
          </p>
        </div>

        <!-- Importing phase -->
        <div
          v-else-if="phase === 'importing'"
          class="grid gap-2"
          data-testid="tracker-import-importing"
        >
          <div role="status" aria-live="polite" class="text-sm font-medium">
            {{
              t('trackerImport.importingProgress', {
                completed: importedMonths,
                total: totalMonths,
              })
            }}
          </div>
          <UProgress :model-value="importedMonths" :max="totalMonths || 1" />
        </div>

        <!-- Done phase -->
        <div
          v-else-if="phase === 'done' && result"
          class="grid gap-2"
          data-testid="tracker-import-done"
        >
          <p role="status" class="m-0 flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-check-circle" class="text-success" />
            {{ t('trackerImport.doneHeading') }}
          </p>
          <dl class="m-0 grid gap-1 text-sm">
            <div class="flex justify-between">
              <dt>{{ t('trackerImport.doneImportedLabel') }}</dt>
              <dd class="tabular-nums" data-testid="tracker-import-done-imported">
                {{ result.totalImported }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt>{{ t('trackerImport.doneLinkedLabel') }}</dt>
              <dd class="tabular-nums" data-testid="tracker-import-done-linked">
                {{ result.totalSkippedExisting }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt>{{ t('trackerImport.doneUnmatchedLabel') }}</dt>
              <dd class="tabular-nums" data-testid="tracker-import-done-unmatched">
                {{ result.totalUnmatched }}
              </dd>
            </div>
          </dl>
          <p class="m-0 text-sm text-muted">{{ t('trackerImport.syntheticTimesNote') }}</p>
        </div>

        <!-- Error phase -->
        <div
          v-else-if="phase === 'error' && errorState"
          class="grid gap-2"
          data-testid="tracker-import-error"
        >
          <p role="alert" class="m-0 flex items-center gap-2 text-error">
            <UIcon name="i-lucide-alert-triangle" />
            {{ t(errorState.messageKey) }}
          </p>
          <p class="m-0 text-sm text-muted" data-testid="tracker-import-committed-months">
            {{
              errorState.stage === 'import'
                ? t('trackerImport.errorCommittedMonthsImport', {
                    completed: errorState.monthsCompleted,
                    total: errorState.totalMonths,
                  })
                : t('trackerImport.errorCommittedMonthsScan')
            }}
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <template v-if="phase === 'range'">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('trackerImport.cancelButton')"
            data-testid="tracker-import-cancel"
            @click="closeDialog"
          />
          <UButton
            color="primary"
            :disabled="!projectsLoaded"
            :label="t('trackerImport.scanButton')"
            data-testid="tracker-import-scan"
            @click="submitRange"
          />
        </template>

        <template v-else-if="phase === 'scanning'">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('trackerImport.cancelScanButton')"
            data-testid="tracker-import-cancel-scan"
            @click="importState.cancelScan()"
          />
        </template>

        <template v-else-if="phase === 'preview'">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('trackerImport.backButton')"
            data-testid="tracker-import-back"
            @click="backToRange"
          />
          <UButton
            color="primary"
            :disabled="hasNothingToImport"
            :label="t('trackerImport.importButton', { count: totalWouldImport })"
            data-testid="tracker-import-confirm"
            @click="confirmImport"
          />
        </template>

        <template v-else-if="phase === 'done'">
          <UButton
            color="primary"
            :label="t('trackerImport.closeButton')"
            data-testid="tracker-import-close"
            @click="closeDialog"
          />
        </template>

        <template v-else-if="phase === 'error'">
          <UButton
            color="neutral"
            variant="ghost"
            :label="t('trackerImport.closeButton')"
            data-testid="tracker-import-error-close"
            @click="closeDialog"
          />
          <UButton
            color="primary"
            :label="t('trackerImport.retryButton')"
            data-testid="tracker-import-retry"
            @click="importState.retry()"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
