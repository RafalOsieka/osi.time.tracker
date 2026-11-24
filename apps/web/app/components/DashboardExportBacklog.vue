<script setup lang="ts">
/** The days of the Export backlog, each a link to its Remote Sync page. */
const { days } = defineProps<{
  /** Calendar days, oldest first. */
  days: string[];
}>();

const { t, locale } = useI18n();

/** Days are calendar dates, so they format in UTC to stay on the same day. */
const dayFormat = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
);
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
    data-testid="dashboard-export-backlog"
  >
    <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0 text-warning" aria-hidden="true" />
    <span class="font-medium text-highlighted">{{ t('dashboard.exportBacklog') }}:</span>
    <ul
      class="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0"
      :aria-label="t('dashboard.exportBacklog')"
    >
      <li v-for="day in days" :key="day">
        <ULink
          :to="`/sync/${day}`"
          class="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {{ dayFormat.format(new Date(`${day}T00:00:00Z`)) }}
        </ULink>
      </li>
    </ul>
  </div>
</template>
