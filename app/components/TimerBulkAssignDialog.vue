<script setup lang="ts">
import type { FormErrorEvent } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { buildTaskTitleMenuItems } from '~/utils/taskTitleMenu';
import type { TimerBulkAssignFormDto } from '../../shared/types/time-entry';

const props = defineProps<{
  visible: boolean;
  ids: string[];
  projectOptions: ProjectDto[];
}>();

const emit = defineEmits<{ 'update:visible': [boolean]; assigned: [] }>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();

const open = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

/** UI allows empty optional project before submit; schema validates on save. */
type BulkAssignFormState = {
  title: string;
  projectId?: string;
};

const state = reactive<BulkAssignFormState>({
  title: '',
  projectId: undefined,
});
const searchTerm = ref('');
const suggestions = ref<TaskDto[]>([]);
const nameError = ref('');
const saving = ref(false);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      state.title = '';
      searchTerm.value = '';
      state.projectId = undefined;
      nameError.value = '';
    }
  },
);

async function search(query: string) {
  suggestions.value = await $fetch<TaskDto[]>('/api/tasks', { query: { search: query } });
}

watch(searchTerm, (query) => {
  void search(query ?? '');
});

function onSelectTask(task: TaskDto) {
  state.title = task.name;
  searchTerm.value = task.name;
  state.projectId = task.projectId ?? undefined;
}

function onSelectCreate(title: string) {
  state.title = title;
  searchTerm.value = title;
}

const titleMenuItems = computed(() =>
  buildTaskTitleMenuItems({
    suggestions: suggestions.value,
    searchText: searchTerm.value ?? '',
    noProjectLabel: t('timer.noTask'),
    createOptionLabel: (typed) => t('timer.createOption', { title: typed }),
    onSelectTask,
    onSelectCreate,
  }),
);

function close() {
  open.value = false;
}

function onError(event: FormErrorEvent) {
  const err = event.errors.find((error) => error.name === 'title');
  nameError.value = err && typeof err.message === 'string' ? t(err.message) : '';
}

async function onSave() {
  const trimmed = state.title.trim();
  nameError.value = '';
  saving.value = true;
  try {
    const body: TimerBulkAssignFormDto & { ids: string[] } = {
      ids: props.ids,
      title: trimmed,
      projectId: state.projectId ?? null,
    };
    await $csrfFetch('/api/time-entries/bulk-assign', {
      method: 'POST',
      body,
    });
    toast.success(
      t('timerView.bulkAssign.toastSuccessSummary'),
      t('timerView.bulkAssign.toastSuccessDetail', { name: trimmed }),
    );
    close();
    emit('assigned');
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    toast.error(t(key));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('timerView.bulkAssign.dialogTitle')">
    <template #body>
      <UForm
        :schema="timerBulkAssignFormSchema"
        :state="state"
        data-testid="bulk-assign-dialog"
        class="grid min-w-80 gap-3"
        @submit="onSave"
        @error="onError"
      >
        <div class="grid gap-1">
          <label for="bulk-assign-name">{{ t('timerView.bulkAssign.nameLabel') }}</label>
          <UInputMenu
            id="bulk-assign-name"
            v-model="state.title"
            v-model:search-term="searchTerm"
            :items="titleMenuItems"
            value-key="name"
            label-key="label"
            mode="autocomplete"
            ignore-filter
            :placeholder="t('timerView.bulkAssign.namePlaceholder')"
            :aria-invalid="!!nameError || undefined"
            :aria-describedby="nameError ? 'bulk-assign-name-error' : undefined"
            data-testid="bulk-assign-name-input"
          />
        </div>
        <p
          v-if="nameError"
          id="bulk-assign-name-error"
          class="m-0 text-sm text-error"
          role="alert"
          data-testid="bulk-assign-name-error"
        >
          {{ nameError }}
        </p>

        <div class="grid gap-1">
          <label for="bulk-assign-project">{{ t('timerView.bulkAssign.projectLabel') }}</label>
          <USelect
            id="bulk-assign-project"
            v-model="state.projectId"
            :items="projectOptions"
            value-key="id"
            label-key="name"
            :placeholder="t('timerView.bulkAssign.projectPlaceholder')"
            class="w-full"
            data-testid="bulk-assign-project-select"
          />
        </div>

        <FormDialogFooter
          :cancel-label="t('timerView.bulkAssign.cancelButton')"
          :save-label="t('timerView.bulkAssign.saveButton')"
          :saving="saving"
          @cancel="close"
        />
      </UForm>
    </template>
  </UModal>
</template>
