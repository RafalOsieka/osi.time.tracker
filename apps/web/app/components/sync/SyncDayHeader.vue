<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';
import { CalendarDate, parseDate } from '@internationalized/date';

const { date, dateLabel, exportLabel, exportDisabled } = defineProps<{
  date: string;
  dateLabel: string;
  exportLabel: string;
  exportDisabled: boolean;
}>();

const emit = defineEmits<{
  navigate: [isoDate: string];
  export: [];
}>();

const { t } = useI18n();
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
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
          class="min-w-44 justify-center font-medium text-highlighted"
          :aria-label="t('remoteSync.calendarLabel')"
          data-testid="remote-sync-date-label"
        >
          {{ dateLabel }}
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
    <UButton
      icon="i-lucide-upload"
      :label="exportLabel"
      :disabled="exportDisabled"
      data-testid="remote-sync-export-button"
      @click="emit('export')"
    />
  </PageHeader>
</template>
