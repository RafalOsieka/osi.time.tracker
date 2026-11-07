<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app';
import type { FormError } from '@nuxt/ui';
import type { MessageParams } from '~~/shared/types/message-params';
import {
  REPORT_PRESET_CLIENT_NAME_MAX_LENGTH,
  REPORT_PRESET_CONTRACTOR_DETAILS_MAX_LENGTH,
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

/**
 * The form edits contractor details as a string (empty for none) for `UTextarea`;
 * parsing with the shared schema on export turns blank back into `null` (design D4).
 */
type PresetFormState = Omit<ReportPresetInput, 'contractorDetails'> & {
  contractorDetails: string;
};

const uiLocale = computed((): ReportLocale => (locale.value === 'pl' ? 'pl' : 'en'));
const state = reactive<PresetFormState>({
  clientName: '',
  contractorDetails: '',
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
  state.contractorDetails = preset.contractorDetails ?? '';
  state.trackerIds = preset.trackers.map((tracker) => tracker.id);
  state.hoursFormat = preset.hoursFormat;
  state.locale = preset.locale;
}

function startNewPreset() {
  selectedPresetId.value = null;
  state.clientName = '';
  state.contractorDetails = '';
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

/** Export saves the form first (REQ-473), so the label says so while there is something to save. */
const hasUnsavedChanges = computed(() => {
  const preset = selectedPreset.value;
  if (!preset) return true;
  const trackerIds = preset.trackers.map((tracker) => tracker.id);
  return (
    state.clientName.trim() !== preset.clientName ||
    state.contractorDetails.trim() !== (preset.contractorDetails ?? '') ||
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

function validate(formState: PresetFormState): Promise<FormError[]> {
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
    <PageHeader :title="t('clientReport.pageTitle')">
      <PeriodStepper
        :prev-label="t('reports.monthly.previousMonth')"
        :next-label="t('reports.monthly.nextMonth')"
        prev-testid="client-report-month-prev"
        next-testid="client-report-month-next"
        :disabled="!month"
        @prev="goMonth(-1)"
        @next="goMonth(1)"
      >
        <PeriodLabel data-testid="client-report-month-label">{{ monthLabel }}</PeriodLabel>
      </PeriodStepper>
    </PageHeader>

    <p v-if="monthInvalid" class="text-error" role="alert" data-testid="client-report-month-error">
      {{ t('clientReport.invalidMonth') }}
    </p>

    <!-- Desktop split: configuration on the left, the preview beside it; stacked below lg. -->
    <div class="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <div
        v-if="!formReady"
        class="grid content-start gap-5 rounded-lg border border-default p-6"
        aria-busy="true"
        :aria-label="t('clientReport.loading')"
        data-testid="client-report-loading"
      >
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>

      <UForm
        v-else
        :validate="validate"
        :state="state"
        class="min-w-0"
        data-testid="client-report-form"
        @submit="onExport"
      >
        <UCard :ui="{ body: 'space-y-5', footer: 'space-y-3' }">
          <p
            v-if="presetsStatus === 'error'"
            class="text-sm text-error"
            role="alert"
            data-testid="client-report-presets-error"
          >
            {{ t('clientReport.presetsLoadFailed') }}
          </p>

          <!-- Who the report is for and from. -->
          <div class="space-y-4">
            <UFormField :label="t('clientReport.presetLabel')" name="preset">
              <div class="flex items-center gap-1">
                <USelect
                  id="client-report-preset"
                  :model-value="selectedPresetId ?? NEW_PRESET"
                  :items="presetItems"
                  class="min-w-0 flex-1"
                  data-testid="client-report-preset-select"
                  @update:model-value="onPresetSelected"
                />
                <UTooltip
                  v-if="selectedPreset"
                  :text="t('clientReport.deletePreset')"
                  :content="{ side: 'top' }"
                >
                  <UButton
                    type="button"
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    square
                    class="text-muted hover:bg-error/10 hover:text-error focus-visible:text-error"
                    :aria-label="t('clientReport.deletePreset')"
                    data-testid="client-report-delete-preset"
                    @click="onDelete"
                  />
                </UTooltip>
              </div>
            </UFormField>

            <UAlert
              v-if="selectedPreset && selectedPreset.inactiveTrackerCount > 0"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="
                t(
                  'clientReport.inactiveTrackers',
                  { count: selectedPreset.inactiveTrackerCount },
                  selectedPreset.inactiveTrackerCount,
                )
              "
              data-testid="client-report-inactive-warning"
            />

            <UFormField
              :label="t('clientReport.clientNameLabel')"
              name="clientName"
              :error="clientNameError || undefined"
            >
              <UInput
                id="client-report-client-name"
                v-model="state.clientName"
                :maxlength="REPORT_PRESET_CLIENT_NAME_MAX_LENGTH"
                class="w-full"
                data-testid="client-report-client-name"
              />
            </UFormField>

            <!-- The help button sits in the hint slot, beside (not inside) the field's <label>. -->
            <UFormField
              :label="t('clientReport.contractorDetailsLabel')"
              name="contractorDetails"
              :ui="{ labelWrapper: 'justify-start' }"
            >
              <template #hint>
                <UTooltip
                  :text="t('clientReport.contractorDetailsHelp')"
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
                    :aria-label="t('clientReport.contractorDetailsHelpAria')"
                    data-testid="client-report-contractor-details-help"
                  />
                </UTooltip>
              </template>
              <UTextarea
                id="client-report-contractor-details"
                v-model="state.contractorDetails"
                :maxlength="REPORT_PRESET_CONTRACTOR_DETAILS_MAX_LENGTH"
                :rows="3"
                autoresize
                class="w-full"
                data-testid="client-report-contractor-details"
              />
            </UFormField>
          </div>

          <USeparator />

          <!-- What goes into the PDF and how it reads. -->
          <div class="space-y-4">
            <UFormField :label="t('clientReport.trackersLabel')" name="trackerIds">
              <UCheckboxGroup
                v-if="trackerItems.length > 0"
                v-model="state.trackerIds"
                :items="trackerItems"
                :ui="{ fieldset: 'gap-y-2', label: 'font-normal' }"
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
                :ui="{ fieldset: 'flex-wrap gap-x-6 gap-y-2', label: 'font-normal' }"
                data-testid="client-report-hours-format"
              />
            </UFormField>

            <UFormField :label="t('clientReport.localeLabel')" name="locale">
              <URadioGroup
                v-model="state.locale"
                :items="localeItems"
                orientation="horizontal"
                :ui="{ fieldset: 'flex-wrap gap-x-6 gap-y-2', label: 'font-normal' }"
                data-testid="client-report-locale"
              />
            </UFormField>
          </div>

          <template #footer>
            <UButton
              type="submit"
              icon="i-lucide-file-down"
              block
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
              class="text-sm"
              :class="exportMessage.tone === 'error' ? 'text-error' : 'text-muted'"
              :role="exportMessage.tone === 'error' ? 'alert' : 'status'"
              data-testid="client-report-export-message"
            >
              {{ t(exportMessage.key, exportMessage.params ?? {}) }}
            </p>
          </template>
        </UCard>
      </UForm>

      <!--
        A page-on-desk placeholder (REQ-384): the sheet always sits lighter than its pane, white
        on light grey and a raised grey in dark. The faint lines only suggest a document.
      -->
      <div
        class="flex min-h-80 items-center justify-center rounded-lg border border-default bg-muted p-8"
        data-testid="client-report-preview"
      >
        <div
          class="flex aspect-[210/297] w-full max-w-64 flex-col gap-5 rounded-md bg-default p-6 shadow-sm ring-1 ring-default dark:bg-elevated dark:shadow-md"
        >
          <div class="grid gap-2" aria-hidden="true">
            <div class="h-2 w-1/2 rounded-full bg-accented" />
            <div class="h-1.5 w-1/3 rounded-full bg-accented/60" />
          </div>
          <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <UIcon name="i-lucide-file-down" class="size-6 text-dimmed" aria-hidden="true" />
            <p class="max-w-[200px] text-sm text-balance text-muted">
              {{
                monthLabel
                  ? t('clientReport.previewPlaceholder', { month: monthLabel })
                  : t('clientReport.previewPlaceholderNoMonth')
              }}
            </p>
          </div>
          <div class="grid gap-2.5" aria-hidden="true">
            <div v-for="row in 4" :key="row" class="flex items-center justify-between gap-6">
              <div class="h-1.5 flex-1 rounded-full bg-accented/60" />
              <div class="h-1.5 w-6 rounded-full bg-accented/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
