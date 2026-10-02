<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app';
import type { FormError } from '@nuxt/ui';
import type { MessageParams } from '~~/shared/types/message-params';
import {
  REPORT_PRESET_CLIENT_NAME_MAX_LENGTH,
  reportPresetInputSchema,
  type ReportHoursFormat,
  type ReportLocale,
  type ReportPresetDto,
  type ReportPresetInput,
} from '~~/shared/types/report-preset';
import type { TrackerDto } from '~~/shared/types/tracker';
import { addCalendarMonths, currentCalendarMonth } from '~~/shared/utils/report-month';
import { validateSchemaWithI18n } from '~/utils/validate-schema-with-i18n';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Selector value of the "new preset" entry; preset ids are uuids, so it cannot collide. */
const NEW_PRESET = 'new';

const { t, locale } = useI18n();
usePageTitle(() => t('clientReport.pageTitle'));
const route = useRoute();
const router = useRouter();
const requestFetch = useRequestFetch();
const { $csrfFetch } = useNuxtApp();
const { effective } = useProfile();
const confirm = useAppConfirm();
const toast = useAppToast();
const { exporting, run } = useClientReportExport();

// --- Month (REQ-384) ---

function firstQueryString(
  value: string | null | undefined | Array<string | null>,
): string | undefined {
  if (value == null || Array.isArray(value)) return undefined;
  return value;
}

const monthQuery = computed(() => firstQueryString(route.query.month));
/** The selected `YYYY-MM`, or `null` while missing or invalid. */
const month = computed(() =>
  monthQuery.value && MONTH_PATTERN.test(monthQuery.value) ? monthQuery.value : null,
);
const monthInvalid = computed(() => monthQuery.value !== undefined && month.value === null);

onMounted(() => {
  if (monthQuery.value !== undefined) return;
  void router.replace({
    path: '/reports/client',
    query: { month: currentCalendarMonth(new Date(), effective.value.timeZone) },
  });
});

const monthLabel = computed(() => {
  if (!month.value) return '';
  return new Date(`${month.value}-01T00:00:00Z`).toLocaleDateString(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
});

function goMonth(delta: number) {
  if (!month.value) return;
  void router.push({
    path: '/reports/client',
    query: { month: addCalendarMonths(month.value, delta) },
  });
}

// --- Presets and form (REQ-385) ---

// Lazy: on the client the await resolves at once and the form fills in (REQ-391);
// on the server it still waits, so the first preset is selected before render.
const {
  data: presets,
  status: presetsStatus,
  refresh: refreshPresets,
} = await useAsyncData(
  'report-presets',
  () => requestFetch<ReportPresetDto[]>('/api/report-presets'),
  { lazy: true },
);
const { data: trackers, status: trackersStatus } = await useAsyncData(
  'trackers',
  () => requestFetch<TrackerDto[]>('/api/trackers'),
  { lazy: true },
);

function isSettled(status: AsyncDataRequestStatus): boolean {
  return status === 'success' || status === 'error';
}
/**
 * The form waits for the first presets and trackers answer so it never shows an empty
 * "new preset" first; later refreshes (after save or delete) keep it on screen.
 */
const formReady = ref(false);

const uiLocale = computed((): ReportLocale => (locale.value === 'pl' ? 'pl' : 'en'));
const state = reactive<ReportPresetInput>({
  clientName: '',
  trackerIds: [],
  hoursFormat: 'decimal',
  locale: uiLocale.value,
});
const selectedPresetId = ref<string | null>(null);
const selectedPreset = computed(
  () => presets.value?.find((preset) => preset.id === selectedPresetId.value) ?? null,
);
const clientNameError = ref('');
const exportMessage = ref<{ key: string; params?: MessageParams; tone: 'error' | 'info' } | null>(
  null,
);

function applyPreset(preset: ReportPresetDto) {
  selectedPresetId.value = preset.id;
  state.clientName = preset.clientName;
  state.trackerIds = preset.trackers.map((tracker) => tracker.id);
  state.hoursFormat = preset.hoursFormat;
  state.locale = preset.locale;
}

function startNewPreset() {
  selectedPresetId.value = null;
  state.clientName = '';
  state.trackerIds = [];
  state.hoursFormat = 'decimal';
  state.locale = uiLocale.value;
  clientNameError.value = '';
  exportMessage.value = null;
}

/** The list is ordered by last use, so its first preset is the one to preselect. */
function selectFirstPreset() {
  const [first] = presets.value ?? [];
  if (first) applyPreset(first);
  else startNewPreset();
}

// Show the form and preselect once, when both lists first settle (already during setup on the server).
watch(
  [presetsStatus, trackersStatus],
  ([presetsLoad, trackersLoad]) => {
    if (formReady.value || !isSettled(presetsLoad) || !isSettled(trackersLoad)) return;
    formReady.value = true;
    selectFirstPreset();
  },
  { immediate: true },
);

/** Saved presets, then the "new preset" entry, which edits an unsaved preset. */
const presetItems = computed(() => [
  ...(presets.value ?? []).map((preset) => ({
    label: preset.clientName,
    value: preset.id,
    icon: undefined,
  })),
  { label: t('clientReport.newPreset'), value: NEW_PRESET, icon: 'i-lucide-plus' },
]);
function onPresetSelected(id: string | null | undefined) {
  if (id === NEW_PRESET) {
    startNewPreset();
    return;
  }
  const preset = presets.value?.find((candidate) => candidate.id === id);
  if (!preset) return;
  applyPreset(preset);
  clientNameError.value = '';
  exportMessage.value = null;
}

/** Export saves the form first (REQ-386), so the label says so while there is something to save. */
const hasUnsavedChanges = computed(() => {
  const preset = selectedPreset.value;
  if (!preset) return true;
  const trackerIds = preset.trackers.map((tracker) => tracker.id);
  return (
    state.clientName.trim() !== preset.clientName ||
    state.trackerIds.length !== trackerIds.length ||
    state.trackerIds.some((id, index) => id !== trackerIds[index]) ||
    state.hoursFormat !== preset.hoursFormat ||
    state.locale !== preset.locale
  );
});

const trackerItems = computed(() =>
  (trackers.value ?? []).map((tracker) => ({ label: tracker.name, value: tracker.id })),
);
const hoursFormatItems = computed(
  () =>
    [
      { label: t('clientReport.hoursFormatHm'), value: 'hm' },
      { label: t('clientReport.hoursFormatDecimal'), value: 'decimal' },
    ] satisfies { label: string; value: ReportHoursFormat }[],
);
const localeItems = computed(
  () =>
    [
      { label: t('locale.en'), value: 'en' },
      { label: t('locale.pl'), value: 'pl' },
    ] satisfies { label: string; value: ReportLocale }[],
);

function validate(formState: ReportPresetInput): Promise<FormError[]> {
  return validateSchemaWithI18n(formState, reportPresetInputSchema, t);
}

async function onDelete() {
  const preset = selectedPreset.value;
  if (!preset) return;
  const accepted = await confirm({
    title: t('clientReport.deleteConfirmTitle', { client: preset.clientName }),
    description: t('clientReport.deleteConfirmMessage'),
    confirmLabel: t('clientReport.deleteConfirmAccept'),
    cancelLabel: t('clientReport.deleteConfirmReject'),
  });
  if (!accepted) return;
  try {
    await $csrfFetch(`/api/report-presets/${preset.id}`, { method: 'DELETE' });
  } catch (err) {
    toast.error(t(extractCaughtMessageKey(err, 'clientReport.deleteFailed')));
    return;
  }
  await refreshPresets();
  selectFirstPreset();
}

// --- Export (REQ-386) ---

async function onExport() {
  if (!month.value) return;
  const parsed = reportPresetInputSchema.safeParse(state);
  if (!parsed.success) return;
  clientNameError.value = '';
  exportMessage.value = null;

  const result = await run({
    input: parsed.data,
    presetId: selectedPresetId.value,
    month: month.value,
    trackers: trackers.value ?? [],
  });
  if (!result) return;

  if (result.saved) {
    selectedPresetId.value = result.saved.id;
    await refreshPresets();
  }

  const { outcome } = result;
  if (outcome.status === 'downloaded') return;
  if (outcome.status === 'empty') {
    exportMessage.value = {
      key: 'clientReport.nothingLogged',
      params: { month: monthLabel.value },
      tone: 'info',
    };
  } else if (outcome.messageKey === 'error.reportPresetClientNameDuplicate') {
    clientNameError.value = t(outcome.messageKey);
  } else {
    exportMessage.value = { key: outcome.messageKey, params: outcome.params, tone: 'error' };
  }
}
</script>

<template>
  <div data-testid="client-report" class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">{{ t('clientReport.pageTitle') }}</h1>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          :aria-label="t('reports.monthly.previousMonth')"
          :disabled="!month"
          data-testid="client-report-month-prev"
          @click="goMonth(-1)"
        />
        <span data-testid="client-report-month-label" class="min-w-40 text-center font-medium">
          {{ monthLabel }}
        </span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          :aria-label="t('reports.monthly.nextMonth')"
          :disabled="!month"
          data-testid="client-report-month-next"
          @click="goMonth(1)"
        />
      </div>
    </div>

    <p v-if="monthInvalid" class="text-error" role="alert" data-testid="client-report-month-error">
      {{ t('clientReport.invalidMonth') }}
    </p>

    <div
      v-if="!formReady"
      class="grid gap-4"
      aria-busy="true"
      :aria-label="t('clientReport.loading')"
      data-testid="client-report-loading"
    >
      <USkeleton class="h-8 w-60" />
      <USkeleton class="h-8 w-full max-w-md" />
      <USkeleton class="h-24 w-full max-w-md" />
    </div>

    <UCard v-else>
      <p
        v-if="presetsStatus === 'error'"
        class="mb-4 text-error"
        role="alert"
        data-testid="client-report-presets-error"
      >
        {{ t('clientReport.presetsLoadFailed') }}
      </p>
      <div class="mb-4 flex flex-wrap items-end gap-2">
        <UFormField :label="t('clientReport.presetLabel')" name="preset" class="min-w-60">
          <USelect
            id="client-report-preset"
            :model-value="selectedPresetId ?? NEW_PRESET"
            :items="presetItems"
            class="w-full"
            data-testid="client-report-preset-select"
            @update:model-value="onPresetSelected"
          />
        </UFormField>
        <UButton
          v-if="selectedPreset"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :label="t('clientReport.deletePreset')"
          data-testid="client-report-delete-preset"
          @click="onDelete"
        />
      </div>

      <UAlert
        v-if="selectedPreset && selectedPreset.inactiveTrackerCount > 0"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        class="mb-4"
        :title="
          t(
            'clientReport.inactiveTrackers',
            { count: selectedPreset.inactiveTrackerCount },
            selectedPreset.inactiveTrackerCount,
          )
        "
        data-testid="client-report-inactive-warning"
      />

      <UForm
        :validate="validate"
        :state="state"
        class="grid gap-4"
        data-testid="client-report-form"
        @submit="onExport"
      >
        <UFormField
          :label="t('clientReport.clientNameLabel')"
          name="clientName"
          :error="clientNameError || undefined"
        >
          <UInput
            id="client-report-client-name"
            v-model="state.clientName"
            :maxlength="REPORT_PRESET_CLIENT_NAME_MAX_LENGTH"
            class="w-full max-w-md"
            data-testid="client-report-client-name"
          />
        </UFormField>

        <UFormField :label="t('clientReport.trackersLabel')" name="trackerIds">
          <UCheckboxGroup
            v-if="trackerItems.length > 0"
            v-model="state.trackerIds"
            :items="trackerItems"
            data-testid="client-report-trackers"
          />
          <p v-else class="text-sm text-muted" data-testid="client-report-no-trackers">
            {{ t('clientReport.noTrackers') }}
          </p>
        </UFormField>

        <UFormField :label="t('clientReport.hoursFormatLabel')" name="hoursFormat">
          <URadioGroup
            v-model="state.hoursFormat"
            :items="hoursFormatItems"
            orientation="horizontal"
            data-testid="client-report-hours-format"
          />
        </UFormField>

        <UFormField :label="t('clientReport.localeLabel')" name="locale">
          <URadioGroup
            v-model="state.locale"
            :items="localeItems"
            orientation="horizontal"
            data-testid="client-report-locale"
          />
        </UFormField>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            type="submit"
            icon="i-lucide-file-down"
            :label="
              hasUnsavedChanges
                ? t('clientReport.saveAndExportButton')
                : t('clientReport.exportButton')
            "
            :loading="exporting"
            :disabled="!month"
            data-testid="client-report-export"
          />
          <p
            v-if="exportMessage"
            :class="exportMessage.tone === 'error' ? 'text-error' : 'text-muted'"
            :role="exportMessage.tone === 'error' ? 'alert' : 'status'"
            data-testid="client-report-export-message"
          >
            {{ t(exportMessage.key, exportMessage.params ?? {}) }}
          </p>
        </div>
      </UForm>
    </UCard>

    <div
      class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default p-10 text-muted"
      data-testid="client-report-preview"
    >
      <UIcon name="i-lucide-file-text" class="size-8" aria-hidden="true" />
      <p>{{ t('clientReport.previewPlaceholder') }}</p>
    </div>
  </div>
</template>
