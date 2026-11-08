<script setup lang="ts">
/**
 * The timezone a form's wall-clock values are in, as one quiet metadata line: a globe glyph and
 * the zone with its UTC offset ("Europe/Warsaw (UTC+01:00)"). Screen readers hear the "Time zone:"
 * prefix, and a tooltip spells it out. Used by the top-bar start editor and the add-entry dialog.
 */
const { zone, testid } = defineProps<{
  /** The zone with its offset, from `timeZoneLabel()`. */
  zone: string;
  testid: string;
}>();

const { t } = useI18n();
</script>

<template>
  <UTooltip :text="t('timer.startEditor.timeZoneHint', { zone })" :content="{ side: 'bottom' }">
    <p
      tabindex="0"
      class="m-0 flex min-w-0 items-center gap-1 text-xs text-muted"
      :data-testid="testid"
    >
      <UIcon name="i-lucide-globe" class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="sr-only">{{ t('timer.startEditor.timeZoneLabel') }}</span>
      <span class="truncate">{{ zone }}</span>
    </p>
  </UTooltip>
</template>
