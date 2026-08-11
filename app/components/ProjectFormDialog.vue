<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { validateSchemaWithI18n } from '~/utils/validateSchemaWithI18n';

const props = defineProps<{
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
  get: () => props.open,
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
};

const state = reactive<ProjectFormState>({
  name: '',
  trackerId: undefined,
});
const nameServerError = ref('');
const trackerServerError = ref('');
const saving = ref(false);

function seedForm(project: ProjectDto | null) {
  state.name = project?.name ?? '';
  state.trackerId = project?.trackerId ?? undefined;
  nameServerError.value = '';
  trackerServerError.value = '';
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
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    seedForm(props.project);
    void fetchTrackerOptions();
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

  // Re-parse for trim/coercion (UForm validate already ran the same schema in the real UI).
  const parsed = createProjectSchema.safeParse(state);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.message;
      if (issue.path[0] === 'name') nameServerError.value = t(key);
      else if (issue.path[0] === 'trackerId') trackerServerError.value = t(key);
    }
    return;
  }
  const data = parsed.data;
  const nextTrackerId = data.trackerId ?? null;
  const previousTrackerId = props.project?.trackerId ?? null;
  if (props.project && previousTrackerId && nextTrackerId !== previousTrackerId) {
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
    };
    if (props.project) {
      const updated = await $csrfFetch<ProjectDto>(`/api/projects/${props.project.id}`, {
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
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.projectNameRequired' ||
      key === 'error.projectNameDuplicate' ||
      key === 'error.projectNameTooLong'
    ) {
      nameServerError.value = t(key);
    } else if (key === 'error.projectTrackerInvalid') {
      trackerServerError.value = t(key);
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
              v-model="state.trackerId"
              :items="trackerOptions"
              value-key="id"
              label-key="name"
              :placeholder="t('projects.trackerPlaceholder')"
              :loading="trackersPending"
              clearable
              class="w-full"
              data-testid="project-tracker-select"
            />
            <template v-if="trackerServerError" #error>
              <span id="project-tracker-error" data-testid="project-tracker-error" role="alert">
                {{ trackerServerError }}
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
