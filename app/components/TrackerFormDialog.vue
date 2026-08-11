<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui';
import { useI18n } from 'vue-i18n';
import { validateSchemaWithI18n } from '~/utils/validateSchemaWithI18n';

const props = defineProps<{
  open: boolean;
  tracker: TrackerDto | null;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [];
}>();

const { t } = useI18n();
const toast = useAppToast();
const { $csrfFetch } = useNuxtApp();
const { get: getSecret, set: setSecret } = useTrackerSecret();

const dialogOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const systemTypeItems = TRACKER_SYSTEM_TYPE_ORDER.map((value) => ({
  label: TRACKER_SYSTEM_TYPE_LABELS[value],
  value,
}));
const roundingRuleItems = computed(() =>
  TRACKER_ROUNDING_RULE_ORDER.map((value) => ({
    label: t(`trackers.roundingRule.${value}`),
    value,
  })),
);
const executionModeLabelKeys = {
  client: 'trackers.executionModeClient',
  server: 'trackers.executionModeServer',
} as const satisfies Record<TrackerExecutionMode, string>;
const executionModeItems = computed(() =>
  TRACKER_EXECUTION_MODE_ORDER.map((value) => ({
    label: t(executionModeLabelKeys[value]),
    value,
  })),
);

const state = reactive<{
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  executionMode: TrackerExecutionMode;
  roundingRule: TrackerRoundingRule;
}>({
  name: '',
  systemType: TRACKER_SYSTEM_TYPE_ORDER[0],
  baseUrl: '',
  executionMode: TRACKER_EXECUTION_MODE_ORDER[0],
  roundingRule: TRACKER_ROUNDING_RULE_ORDER[0],
});
const secret = ref('');
const nameServerError = ref('');
const baseUrlServerError = ref('');
const systemTypeServerError = ref('');
const saving = ref(false);
const formKey = computed(() => props.tracker?.id ?? 'new');

function seedForm(tracker: TrackerDto | null) {
  state.name = tracker?.name ?? '';
  state.systemType = tracker?.systemType ?? TRACKER_SYSTEM_TYPE_ORDER[0];
  state.baseUrl = tracker?.baseUrl ?? '';
  state.executionMode = tracker?.executionMode ?? TRACKER_EXECUTION_MODE_ORDER[0];
  state.roundingRule = tracker?.roundingRule ?? TRACKER_ROUNDING_RULE_ORDER[0];
  secret.value = tracker ? (getSecret(tracker.id) ?? '') : '';
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    seedForm(props.tracker);
  },
);

function closeDialog() {
  dialogOpen.value = false;
}

type TrackerFormState = {
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  executionMode: TrackerExecutionMode;
  roundingRule: TrackerRoundingRule;
};

/** Translate Zod message keys at validation time so UFormField never shows raw keys. */
function validate(formState: TrackerFormState): Promise<FormError[]> {
  return validateSchemaWithI18n(formState, createTrackerSchema, t);
}

async function onSave(_event: FormSubmitEvent<TrackerFormState>) {
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';

  // Re-parse for trim/coercion (UForm validate already ran the same schema in the real UI).
  const parsed = createTrackerSchema.safeParse(state);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.message;
      if (issue.path[0] === 'name') nameServerError.value = t(key);
      else if (issue.path[0] === 'baseUrl') baseUrlServerError.value = t(key);
      else if (issue.path[0] === 'systemType') systemTypeServerError.value = t(key);
    }
    return;
  }
  const data = parsed.data;

  saving.value = true;
  try {
    const payload: CreateTrackerDto = {
      name: data.name,
      systemType: data.systemType,
      baseUrl: data.baseUrl,
      executionMode: data.executionMode,
      roundingRule: data.roundingRule,
    };
    if (props.tracker) {
      const updated = await $csrfFetch<TrackerDto>(`/api/trackers/${props.tracker.id}`, {
        method: 'PATCH',
        body: payload,
      });
      if (secret.value) {
        setSecret(updated.id, secret.value);
      }
      toast.success(
        t('trackers.toastUpdatedSummary'),
        t('trackers.toastUpdatedDetail', { name: updated.name }),
      );
    } else {
      const created = await $csrfFetch<TrackerDto>('/api/trackers', {
        method: 'POST',
        body: payload,
      });
      if (secret.value) {
        setSecret(created.id, secret.value);
      }
      toast.success(
        t('trackers.toastCreatedSummary'),
        t('trackers.toastCreatedDetail', { name: created.name }),
      );
    }
    closeDialog();
    emit('saved');
  } catch (err: unknown) {
    const key = extractMessageKey(err, 'errors.unexpected');
    if (
      key === 'error.trackerNameRequired' ||
      key === 'error.trackerNameDuplicate' ||
      key === 'error.trackerNameTooLong'
    ) {
      nameServerError.value = t(key);
    } else if (key === 'error.trackerBaseUrlRequired' || key === 'error.trackerBaseUrlInvalid') {
      baseUrlServerError.value = t(key);
    } else if (key === 'error.trackerSystemTypeRequired') {
      systemTypeServerError.value = t(key);
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
    :title="tracker ? t('trackers.dialogTitleEdit') : t('trackers.dialogTitleCreate')"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(value: boolean) => !value && closeDialog()"
  >
    <template #body>
      <div data-testid="tracker-dialog" class="grid gap-3">
        <UForm
          :key="formKey"
          :validate="validate"
          :state="state"
          class="grid gap-3"
          @submit="onSave"
        >
          <UFormField
            :label="t('trackers.nameLabel')"
            name="name"
            :error="nameServerError || undefined"
          >
            <UInput
              id="tracker-name"
              v-model="state.name"
              :maxlength="TRACKER_NAME_MAX_LENGTH"
              :placeholder="t('trackers.namePlaceholder')"
              class="w-full"
              data-testid="tracker-name-input"
            />
            <template v-if="nameServerError" #error>
              <span id="tracker-name-error" data-testid="tracker-name-error" role="alert">
                {{ nameServerError }}
              </span>
            </template>
          </UFormField>

          <UFormField
            :label="t('trackers.systemTypeLabel')"
            name="systemType"
            :error="systemTypeServerError || undefined"
          >
            <USelect
              id="tracker-system-type"
              v-model="state.systemType"
              :items="systemTypeItems"
              value-key="value"
              label-key="label"
              class="w-full"
              data-testid="tracker-system-type-select"
            />
            <template v-if="systemTypeServerError" #error>
              <span
                id="tracker-system-type-error"
                data-testid="tracker-system-type-error"
                role="alert"
              >
                {{ systemTypeServerError }}
              </span>
            </template>
          </UFormField>

          <UFormField
            :label="t('trackers.baseUrlLabel')"
            name="baseUrl"
            :error="baseUrlServerError || undefined"
          >
            <UInput
              id="tracker-base-url"
              v-model="state.baseUrl"
              :placeholder="t('trackers.baseUrlPlaceholder')"
              class="w-full"
              data-testid="tracker-base-url-input"
            />
            <template v-if="baseUrlServerError" #error>
              <span id="tracker-base-url-error" data-testid="tracker-base-url-error" role="alert">
                {{ baseUrlServerError }}
              </span>
            </template>
          </UFormField>

          <UFormField :label="t('trackers.executionModeLabel')" name="executionMode">
            <USelect
              id="tracker-execution-mode"
              v-model="state.executionMode"
              :items="executionModeItems"
              value-key="value"
              label-key="label"
              class="w-full"
              data-testid="tracker-execution-mode-select"
            />
          </UFormField>

          <UFormField :label="t('trackers.roundingRuleLabel')" name="roundingRule">
            <USelect
              id="tracker-rounding-rule"
              v-model="state.roundingRule"
              :items="roundingRuleItems"
              value-key="value"
              label-key="label"
              class="w-full"
              data-testid="tracker-rounding-rule-select"
            />
          </UFormField>

          <UFormField :label="t('trackers.secretLabel')" name="secret">
            <UInput
              id="tracker-secret"
              v-model="secret"
              type="password"
              :placeholder="t('trackers.secretPlaceholder')"
              class="w-full"
              data-testid="tracker-secret-input"
            />
          </UFormField>

          <FormDialogFooter
            :cancel-label="t('trackers.cancelButton')"
            :save-label="t('trackers.saveButton')"
            :saving="saving"
            @cancel="closeDialog"
          />
        </UForm>
      </div>
    </template>
  </UModal>
</template>
