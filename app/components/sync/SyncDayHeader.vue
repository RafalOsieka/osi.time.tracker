<script setup lang="ts">
import { Temporal } from 'temporal-polyfill';

const { date, timeZone, heading } = defineProps<{
  date: string;
  timeZone: string;
  heading: string;
}>();

const emit = defineEmits<{
  navigate: [isoDate: string];
}>();

const { t } = useI18n();
const calendarOpen = ref(false);
const dateInput = ref(date);

watch(
  () => date,
  (value) => {
    dateInput.value = value;
  },
);

function shift(days: number) {
  const next = Temporal.PlainDate.from(date).add({ days }).toString();
  emit('navigate', next);
}

function goToday() {
  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
  emit('navigate', today);
}

function onDateInputChange() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) return;
  if (Number.isNaN(new Date(`${dateInput.value}T00:00:00Z`).getTime())) return;
  calendarOpen.value = false;
  emit('navigate', dateInput.value);
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-testid="remote-sync-day-nav">
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
    <h2 class="text-2xl font-semibold" data-testid="remote-sync-heading">
      {{ t('remoteSync.pageTitle', { date: heading }) }}
    </h2>
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
      color="neutral"
      variant="ghost"
      size="sm"
      :label="t('remoteSync.today')"
      data-testid="remote-sync-today"
      @click="goToday"
    />
    <UPopover v-model:open="calendarOpen">
      <UButton
        icon="i-lucide-calendar"
        color="neutral"
        variant="ghost"
        size="sm"
        :label="t('remoteSync.pickDate')"
        data-testid="remote-sync-pick-date"
      />
      <template #content>
        <div class="grid gap-2 p-3" data-testid="remote-sync-calendar">
          <label for="remote-sync-calendar-input" class="text-sm text-muted">
            {{ t('remoteSync.calendarLabel') }}
          </label>
          <UInput
            id="remote-sync-calendar-input"
            v-model="dateInput"
            type="date"
            data-testid="remote-sync-calendar-input"
            @change="onDateInputChange"
            @keydown.enter.prevent="onDateInputChange"
          />
        </div>
      </template>
    </UPopover>
  </div>
</template>
