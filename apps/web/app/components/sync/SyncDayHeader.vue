<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import { CalendarDate, parseDate } from '@internationalized/date';

const {
  date,
  dateLabel,
  dateLabelShort,
  exportLabel,
  exportDisabled,
  exportDisabledReason = null,
} = defineProps<{
  date: string;
  /** The day as the Timer view's day heading writes it ("Sobota, 7 listopada 2026"). */
  dateLabel: string;
  /** The same day, shortened for phones ("sob., 7 lis 2026"). */
  dateLabelShort: string;
  exportLabel: string;
  exportDisabled: boolean;
  /** Why Export is disabled, shown under it and in its tooltip. */
  exportDisabledReason?: string | null;
}>();

const emit = defineEmits<{
  navigate: [isoDate: string];
  export: [];
}>();

const { t } = useI18n();
const reasonId = useId();
const calendarOpen = ref(false);
const calendarValue = computed(() => parseDate(date));

function shift(days: number) {
  const next = Temporal.PlainDate.from(date).add({ days }).toString();
  emit('navigate', next);
}

function onCalendarSelect(value: CalendarDate | null) {
  calendarOpen.value = false;
  if (!value) return;
  const iso = value.toString();
  if (iso === date) return;
  emit('navigate', iso);
}
</script>

<template>
  <PageHeader
    :title="t('remoteSync.pageTitle')"
    heading-testid="remote-sync-heading"
    data-testid="remote-sync-day-nav"
  >
    <PeriodStepper
      :prev-label="t('remoteSync.prevDay')"
      :next-label="t('remoteSync.nextDay')"
      prev-testid="remote-sync-prev-day"
      next-testid="remote-sync-next-day"
      @prev="shift(-1)"
      @next="shift(1)"
    >
      <UPopover v-model:open="calendarOpen">
        <!-- Wide enough for most full dates, so stepping days rarely changes the stepper's width. -->
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
          class="justify-center font-medium text-highlighted sm:min-w-68"
          :aria-label="t('remoteSync.calendarLabel')"
          data-testid="remote-sync-date-label"
        >
          <span class="hidden sm:inline">{{ dateLabel }}</span>
          <span class="sm:hidden">{{ dateLabelShort }}</span>
        </UButton>
        <template #content>
          <div data-testid="remote-sync-calendar">
            <UCalendar
              class="p-2"
              :model-value="calendarValue"
              :aria-label="t('remoteSync.calendarLabel')"
              @update:model-value="
                (value) => onCalendarSelect(value instanceof CalendarDate ? value : null)
              "
            />
          </div>
        </template>
      </UPopover>
    </PeriodStepper>
    <!-- Export is the page's primary action. Unavailable, it turns neutral (no cyan, so it never
         reads as enabled) and says why: a short line under it (from md up), hung in the gap below
         the header so the stepper and Export never move, and the tooltip on its focusable host. -->
    <div class="relative">
      <UTooltip :text="exportDisabledReason ?? ''" :disabled="!exportDisabledReason">
        <span
          :tabindex="exportDisabledReason ? 0 : undefined"
          :aria-describedby="exportDisabledReason ? reasonId : undefined"
          class="inline-flex rounded-md"
        >
          <UButton
            icon="i-lucide-upload"
            :label="exportLabel"
            :color="exportDisabled ? 'neutral' : 'primary'"
            :variant="exportDisabled ? 'soft' : 'solid'"
            :disabled="exportDisabled"
            class="disabled:text-dimmed disabled:opacity-100"
            data-testid="remote-sync-export-button"
            @click="emit('export')"
          />
        </span>
      </UTooltip>
      <span
        v-if="exportDisabledReason"
        :id="reasonId"
        class="pointer-events-none absolute end-0 top-full mt-1 hidden text-xs/4 whitespace-nowrap text-muted md:block"
        data-testid="remote-sync-export-reason"
      >
        {{ exportDisabledReason }}
      </span>
    </div>
  </PageHeader>
</template>
