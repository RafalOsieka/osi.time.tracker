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
  exportOpen = false,
} = defineProps<{
  date: string;
  /** The day as the Timer view's day heading writes it (`formatDayHeading`). */
  dateLabel: string;
  /** The same day, shortened for phones ("sob., 7 lis 2026"). */
  dateLabelShort: string;
  exportLabel: string;
  exportDisabled: boolean;
  /** Why Export is disabled, shown under it and in its tooltip. */
  exportDisabledReason?: string | null;
  /** The export review is open: Export shows its pressed state, like every dialog trigger. */
  exportOpen?: boolean;
}>();

const emit = defineEmits<{
  navigate: [isoDate: string];
  export: [];
}>();

const { t } = useI18n();
const reasonId = useId();
/**
 * Pressed while its review is open (REQ-514): the same recipe as the page header's create buttons
 * (`TableHeader`), a deep fill with an inset ring, so it reads as held down even under the
 * dialog's scrim.
 */
const PRESSED =
  'bg-(--ui-color-primary-900) ring-2 ring-inset ring-(--ui-color-primary-300) hover:bg-(--ui-color-primary-900) dark:bg-(--ui-color-primary-600) dark:ring-(--ui-color-primary-900) dark:hover:bg-(--ui-color-primary-600)';
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
  <!-- The header row, then one reserved line (from md up) for Export's unavailable reason, so the
       reason has its own place: the stepper and Export never move, and the content below keeps
       the standard 24px gap whether a reason shows or not. -->
  <div class="grid gap-1">
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
         reads as enabled) on one slate fill that shows in both themes, and says why: in the line
         under the header and in the tooltip on its focusable host. -->
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
            aria-haspopup="dialog"
            :aria-expanded="exportOpen"
            class="disabled:bg-accented/70 disabled:text-dimmed disabled:opacity-100 dark:disabled:bg-accented/70"
            :class="exportOpen && PRESSED"
            data-testid="remote-sync-export-button"
            @click="emit('export')"
          />
        </span>
      </UTooltip>
    </PageHeader>
    <p
      :id="reasonId"
      class="m-0 hidden min-h-4 text-end text-xs/4 text-muted md:block"
      data-testid="remote-sync-export-reason-slot"
    >
      <span v-if="exportDisabledReason" data-testid="remote-sync-export-reason">
        {{ exportDisabledReason }}
      </span>
    </p>
  </div>
</template>
