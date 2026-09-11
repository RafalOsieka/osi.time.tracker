<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui';
import type { RemoteProjectDto } from '@osi/remote-trackers/contracts';
import { createRemoteAdapter } from '~/utils/remote/create-remote-adapter';
import { probeExtensionAvailability } from '~/utils/remote/extension-availability';

const { open, project } = defineProps<{
  open: boolean;
  project: ProjectDto | null;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [];
}>();

const { t } = useI18n();
const toast = useAppToast();
const confirm = useAppConfirm();
const { $csrfFetch } = useNuxtApp();
const requestFetch = useRequestFetch();

const dialogOpen = computed({
  get: () => open,
  set: (value: boolean) => emit('update:open', value),
});

const {
  data: trackersData,
  pending: trackersPending,
  refresh: fetchTrackerOptions,
} = useAsyncData('trackers-for-projects', () => requestFetch<TrackerDto[]>('/api/trackers'), {
  server: false,
  immediate: false,
});

const extraTrackerOptions = ref<{ id: string; name: string }[]>([]);
const trackerOptions = computed(() => {
  const active = trackersData.value ?? [];
  const missing = extraTrackerOptions.value.filter(
    (extra) => !active.some((tracker) => tracker.id === extra.id),
  );
  return [...active, ...missing];
});

/** UI uses undefined for empty/local; API null is mapped at open/submit boundaries. */
type ProjectFormState = {
  name: string;
  trackerId?: string;
  remoteProjectId?: string;
  remoteProjectTitle?: string;
};

const state = reactive<ProjectFormState>({
  name: '',
  trackerId: undefined,
  remoteProjectId: undefined,
  remoteProjectTitle: undefined,
});
const nameServerError = ref('');
const trackerServerError = ref('');
const remoteProjectServerError = ref('');
const saving = ref(false);

// Remote project scope (REQ-325/REQ-327): a select over the selected tracker's
// remote project catalog, loaded through the browser-held secret. Falls back
// to a disabled, clearable display of the cached title when no secret is
// available or (extension mode) the installed extension predates the catalog
// operation — the project remains saveable without a scope either way.
const { get: getSecret } = useTrackerSecret();
const remoteProjectCatalog = ref<RemoteProjectDto[]>([]);
const catalogLoading = ref(false);
const catalogErrorKey = ref<string | null>(null);
const catalogUnsupported = ref(false);
/** Seeded cached title, shown when the catalog cannot be browsed. */
const cachedRemoteProjectTitle = ref<string | null>(null);

const selectedTracker = computed<TrackerDto | null>(
  () => (trackersData.value ?? []).find((tracker) => tracker.id === state.trackerId) ?? null,
);
const selectedTrackerSecret = computed(() =>
  selectedTracker.value ? getSecret(selectedTracker.value.id) : null,
);
/** Whether the catalog can actually be browsed right now (vs. the disabled fallback). */
const canBrowseCatalog = computed(
  () => !!selectedTracker.value && !!selectedTrackerSecret.value && !catalogUnsupported.value,
);

// USelect (Nuxt UI v4) has no `clearable` prop — it is silently ignored, which
// left this control with no way to unset a scope once picked. The "whole
// tracker" choice REQ-327 requires is a real list item with this sentinel
// value, not a clear affordance layered on top. Reka UI's underlying
// SelectItem forbids an empty-string value (reserved internally to mean
// "cleared"), so the sentinel must be non-empty.
const WHOLE_TRACKER_VALUE = '__whole-tracker__';

const remoteProjectItems = computed(() => {
  const byParent = new Map<string | undefined, RemoteProjectDto[]>();
  for (const entry of remoteProjectCatalog.value) {
    const list = byParent.get(entry.parentId) ?? [];
    list.push(entry);
    byParent.set(entry.parentId, list);
  }
  const items: { label: string; value: string }[] = [
    { label: t('projects.remoteProjectPlaceholder'), value: WHOLE_TRACKER_VALUE },
  ];
  const visited = new Set<string>();
  function walk(parentId: string | undefined, depth: number) {
    for (const entry of byParent.get(parentId) ?? []) {
      if (visited.has(entry.remoteProjectId)) continue; // defensive: ignore a malformed cycle
      visited.add(entry.remoteProjectId);
      items.push({
        label: `${' '.repeat(depth)}${entry.title}`,
        value: entry.remoteProjectId,
      });
      walk(entry.remoteProjectId, depth + 1);
    }
  }
  walk(undefined, 0);
  return items;
});

async function loadRemoteProjectCatalog() {
  remoteProjectCatalog.value = [];
  catalogErrorKey.value = null;
  catalogUnsupported.value = false;
  const tracker = selectedTracker.value;
  if (!tracker) return;

  if (!tracker.directBrowserAccess) {
    const availability = await probeExtensionAvailability({
      destination: { provider: tracker.systemType, baseUrl: tracker.baseUrl },
    });
    if (!availability.handshake?.supportedOperations.includes('listProjects')) {
      catalogUnsupported.value = true;
      return;
    }
  }

  const secret = selectedTrackerSecret.value;
  if (!secret) return;

  catalogLoading.value = true;
  try {
    const adapter = createRemoteAdapter(tracker, secret);
    remoteProjectCatalog.value = await adapter.listProjects();
  } catch (err) {
    catalogErrorKey.value = extractCaughtMessageKey(err, 'error.remoteProjectsFetchFailed');
  } finally {
    catalogLoading.value = false;
  }
}

function onRemoteProjectSelected(value: string | undefined) {
  const scopeId = value && value !== WHOLE_TRACKER_VALUE ? value : undefined;
  state.remoteProjectId = scopeId;
  state.remoteProjectTitle = scopeId
    ? remoteProjectCatalog.value.find((entry) => entry.remoteProjectId === scopeId)?.title
    : undefined;
}

function clearRemoteProjectScope() {
  state.remoteProjectId = undefined;
  state.remoteProjectTitle = undefined;
  cachedRemoteProjectTitle.value = null;
}

/**
 * Explicit handler (not a `state.trackerId` watcher) so a user-initiated
 * tracker change clears the pending scope and reloads the catalog (REQ-327)
 * without also firing — and wrongly wiping the seeded scope — when
 * `seedForm` programmatically sets `trackerId` while opening the dialog.
 */
function onTrackerSelected(value: string | undefined) {
  state.trackerId = value || undefined;
  state.remoteProjectId = undefined;
  state.remoteProjectTitle = undefined;
  cachedRemoteProjectTitle.value = null;
  void loadRemoteProjectCatalog();
}

function seedForm(project: ProjectDto | null) {
  state.name = project?.name ?? '';
  state.trackerId = project?.trackerId ?? undefined;
  state.remoteProjectId = project?.remoteProjectId ?? undefined;
  state.remoteProjectTitle = project?.remoteProjectTitle ?? undefined;
  cachedRemoteProjectTitle.value = project?.remoteProjectTitle ?? null;
  nameServerError.value = '';
  trackerServerError.value = '';
  remoteProjectServerError.value = '';
  extraTrackerOptions.value = [];
  if (
    project?.trackerId &&
    !trackerOptions.value.some((tracker) => tracker.id === project.trackerId)
  ) {
    extraTrackerOptions.value = [
      {
        id: project.trackerId,
        name: project.trackerName ?? project.trackerId,
      },
    ];
  }
}

watch(
  () => open,
  (isOpen) => {
    if (!isOpen) return;
    seedForm(project);
    void fetchTrackerOptions().then(() => void loadRemoteProjectCatalog());
  },
);

function closeDialog() {
  dialogOpen.value = false;
}

/** Translate Zod message keys at validation time so UFormField never shows raw keys. */
function validate(formState: ProjectFormState): Promise<FormError[]> {
  return validateSchemaWithI18n(formState, createProjectSchema, t);
}

async function onSave(_event: FormSubmitEvent<ProjectFormState>) {
  nameServerError.value = '';
  trackerServerError.value = '';
  remoteProjectServerError.value = '';

  // Re-parse for trim/coercion (UForm validate already ran the same schema in the real UI).
  const parsed = createProjectSchema.safeParse(state);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.message;
      if (issue.path[0] === 'name') nameServerError.value = t(key);
      else if (issue.path[0] === 'trackerId') trackerServerError.value = t(key);
      else if (issue.path[0] === 'remoteProjectId') remoteProjectServerError.value = t(key);
    }
    return;
  }
  const data = parsed.data;
  const nextTrackerId = data.trackerId ?? null;
  const previousTrackerId = project?.trackerId ?? null;
  if (project && previousTrackerId && nextTrackerId !== previousTrackerId) {
    const accepted = await confirm({
      title: t('projects.detachConfirmHeader'),
      description: t('projects.detachConfirmMessage'),
      confirmLabel: t('projects.detachConfirmAccept'),
      cancelLabel: t('projects.detachConfirmReject'),
    });
    if (!accepted) return;
  }

  saving.value = true;
  try {
    const payload: CreateProjectDto = {
      name: data.name,
      trackerId: nextTrackerId,
      remoteProjectId: data.remoteProjectId ?? null,
      remoteProjectTitle: data.remoteProjectTitle ?? null,
    };
    if (project) {
      const updated = await $csrfFetch<ProjectDto>(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: payload satisfies UpdateProjectDto,
      });
      toast.success(
        t('projects.toastUpdatedSummary'),
        t('projects.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
      const created = await $csrfFetch<ProjectDto>('/api/projects', {
        method: 'POST',
        body: payload,
      });
      toast.success(
        t('projects.toastCreatedSummary'),
        t('projects.toastCreatedDetail', { name: created.name }),
      );
    }
    closeDialog();
    emit('saved');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.projectNameRequired' ||
      key === 'error.projectNameDuplicate' ||
      key === 'error.projectNameTooLong'
    ) {
      nameServerError.value = t(key);
    } else if (key === 'error.projectTrackerInvalid') {
      trackerServerError.value = t(key);
    } else if (
      key === 'error.projectRemoteScopeIncomplete' ||
      key === 'error.projectRemoteScopeRequiresTracker'
    ) {
      remoteProjectServerError.value = t(key);
    } else {
      toast.error(t(key));
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    v-model:open="dialogOpen"
    :title="project ? t('projects.dialogTitleEdit') : t('projects.dialogTitleCreate')"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(value: boolean) => !value && closeDialog()"
  >
    <template #body>
      <div data-testid="project-dialog">
        <UForm :validate="validate" :state="state" class="grid gap-3" @submit="onSave">
          <UFormField
            :label="t('projects.nameLabel')"
            name="name"
            :error="nameServerError || undefined"
          >
            <UInput
              id="project-name"
              v-model="state.name"
              :maxlength="PROJECT_NAME_MAX_LENGTH"
              :placeholder="t('projects.namePlaceholder')"
              class="w-full"
              data-testid="project-name-input"
            />
            <template v-if="nameServerError" #error>
              <span id="project-name-error" data-testid="project-name-error" role="alert">
                {{ nameServerError }}
              </span>
            </template>
          </UFormField>

          <UFormField
            :label="t('projects.trackerLabel')"
            name="trackerId"
            :error="trackerServerError || undefined"
          >
            <USelect
              id="project-tracker"
              :model-value="state.trackerId"
              :items="trackerOptions"
              value-key="id"
              label-key="name"
              :placeholder="t('projects.trackerPlaceholder')"
              :loading="trackersPending"
              clearable
              class="w-full"
              data-testid="project-tracker-select"
              @update:model-value="onTrackerSelected"
            />
            <template v-if="trackerServerError" #error>
              <span id="project-tracker-error" data-testid="project-tracker-error" role="alert">
                {{ trackerServerError }}
              </span>
            </template>
          </UFormField>

          <UFormField
            v-if="state.trackerId"
            :label="t('projects.remoteProjectLabel')"
            name="remoteProjectId"
            :error="remoteProjectServerError || undefined"
          >
            <template v-if="canBrowseCatalog">
              <USelect
                id="project-remote-project"
                :model-value="state.remoteProjectId ?? WHOLE_TRACKER_VALUE"
                :items="remoteProjectItems"
                value-key="value"
                label-key="label"
                :loading="catalogLoading"
                class="w-full"
                data-testid="project-remote-project-select"
                @update:model-value="onRemoteProjectSelected"
              />
              <p
                v-if="catalogErrorKey"
                class="mt-1 flex items-center gap-2 text-sm text-error"
                role="alert"
                data-testid="project-remote-project-error"
              >
                {{ t(catalogErrorKey) }}
                <UButton
                  size="xs"
                  variant="link"
                  :label="t('projects.remoteProjectRetry')"
                  data-testid="project-remote-project-retry"
                  @click="loadRemoteProjectCatalog"
                />
              </p>
            </template>
            <template v-else>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted" data-testid="project-remote-project-cached">
                  {{ cachedRemoteProjectTitle ?? t('projects.remoteProjectNone') }}
                </span>
                <UButton
                  v-if="cachedRemoteProjectTitle"
                  size="xs"
                  variant="link"
                  color="neutral"
                  :label="t('projects.remoteProjectClear')"
                  data-testid="project-remote-project-clear"
                  @click="clearRemoteProjectScope"
                />
              </div>
              <p class="mt-1 text-xs text-muted" data-testid="project-remote-project-hint">
                {{
                  catalogUnsupported
                    ? t('projects.remoteProjectExtensionUnsupported')
                    : t('projects.remoteProjectNoSecretHint')
                }}
              </p>
            </template>
            <template v-if="remoteProjectServerError" #error>
              <span
                id="project-remote-project-error-message"
                data-testid="project-remote-project-error-message"
                role="alert"
              >
                {{ remoteProjectServerError }}
              </span>
            </template>
          </UFormField>

          <FormDialogFooter
            :cancel-label="t('projects.cancelButton')"
            :save-label="t('projects.saveButton')"
            :saving="saving"
            @cancel="closeDialog"
          />
        </UForm>
      </div>
    </template>
  </UModal>
</template>
