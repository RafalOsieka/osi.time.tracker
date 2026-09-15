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
  <div class="flex flex-wrap items-center justify-between gap-4" data-testid="remote-sync-day-nav">
    <h1 class="text-xl font-semibold" data-testid="remote-sync-heading">
      {{ t('remoteSync.pageTitle') }}
    </h1>
    <div class="flex flex-wrap items-center gap-2">
      <UTooltip :text="t('remoteSync.prevDay')" :content="{ side: 'top' }">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          square
          :aria-label="t('remoteSync.prevDay')"
          data-testid="remote-sync-prev-day"
          @click="shift(-1)"
        />
      </UTooltip>
      <UPopover v-model:open="calendarOpen">
        <UButton
          color="neutral"
          variant="ghost"
          class="min-w-36 justify-center text-center font-medium"
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
      <UTooltip :text="t('remoteSync.nextDay')" :content="{ side: 'top' }">
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          square
          :aria-label="t('remoteSync.nextDay')"
          data-testid="remote-sync-next-day"
          @click="shift(1)"
        />
      </UTooltip>
      <UButton
        :label="exportLabel"
        :disabled="exportDisabled"
        data-testid="remote-sync-export-button"
        @click="emit('export')"
      />
    </div>
  </div>
</template>
