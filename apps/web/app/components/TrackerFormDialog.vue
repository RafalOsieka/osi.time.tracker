<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui';
import {
  TRACKER_SYSTEM_TYPE_LABELS,
  TRACKER_SYSTEM_TYPE_ORDER,
  type TrackerSystemType,
} from '@osi/remote-trackers/contracts';

const { open, tracker } = defineProps<{
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
const { putTracker } = useActiveTrackers();

const dialogOpen = computed({
  get: () => open,
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

const state = reactive<{
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  directBrowserAccess: boolean;
  roundingRule: TrackerRoundingRule;
}>({
  name: '',
  systemType: TRACKER_SYSTEM_TYPE_ORDER[0],
  baseUrl: '',
  directBrowserAccess: true,
  roundingRule: TRACKER_ROUNDING_RULE_ORDER[0],
});
const secret = ref('');
const nameServerError = ref('');
const baseUrlServerError = ref('');
const systemTypeServerError = ref('');
const saving = ref(false);
const formKey = computed(() => tracker?.id ?? 'new');

function seedForm(tracker: TrackerDto | null) {
  state.name = tracker?.name ?? '';
  state.systemType = tracker?.systemType ?? TRACKER_SYSTEM_TYPE_ORDER[0];
  state.baseUrl = tracker?.baseUrl ?? '';
  state.directBrowserAccess = tracker?.directBrowserAccess ?? true;
  state.roundingRule = tracker?.roundingRule ?? TRACKER_ROUNDING_RULE_ORDER[0];
  secret.value = tracker ? (getSecret(tracker.id) ?? '') : '';
  nameServerError.value = '';
  baseUrlServerError.value = '';
  systemTypeServerError.value = '';
}

watch(
  () => open,
  (isOpen) => {
    if (!isOpen) return;
    seedForm(tracker);
  },
);

function closeDialog() {
  dialogOpen.value = false;
}

type TrackerFormState = {
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  directBrowserAccess: boolean;
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
      directBrowserAccess: data.directBrowserAccess,
      roundingRule: data.roundingRule,
    };
    if (tracker) {
      const updated = await $csrfFetch<TrackerDto>(`/api/trackers/${tracker.id}`, {
        method: 'PATCH',
        body: payload,
      });
      if (secret.value) {
        setSecret(updated.id, secret.value);
      }
      putTracker(updated);
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
      putTracker(created);
      toast.success(
        t('trackers.toastCreatedSummary'),
        t('trackers.toastCreatedDetail', { name: created.name }),
      );
    }
    closeDialog();
    emit('saved');
  } catch (err) {
    const key = extractCaughtMessageKey(err, 'errors.unexpected');
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

          <UFormField name="directBrowserAccess">
            <div class="flex items-center gap-1">
              <UCheckbox
                id="tracker-direct-browser-access"
                v-model="state.directBrowserAccess"
                :label="t('trackers.directBrowserAccessLabel')"
                data-testid="tracker-direct-browser-access"
              />
              <UTooltip
                :text="t('trackers.directBrowserAccessHelp')"
                :delay-duration="0"
                :ui="{
                  content: 'h-auto max-w-xs whitespace-normal',
                  text: 'whitespace-normal',
                }"
              >
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-circle-help"
                  class="text-muted"
                  :ui="{ leadingIcon: 'size-3.5' }"
                  :aria-label="t('trackers.directBrowserAccessHelpAria')"
                  data-testid="tracker-direct-browser-access-help"
                />
              </UTooltip>
            </div>
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
