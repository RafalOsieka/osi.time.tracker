<script setup lang="ts">
/**
 * The title input's Project chip (REQ-374): the Project's name as a small cyan pill with a
 * keyboard-operable remove control that appears on hover or focus. `TaskTitleInput` places it
 * before the text, or after it in the top-bar timer.
 */
const { name, testid } = defineProps<{
  name: string;
  /** Prefix for the test ids: `${testid}-chip` and `${testid}-chip-remove`. */
  testid: string;
}>();

const emit = defineEmits<{ remove: [] }>();

const { t } = useI18n();
</script>

<template>
  <span class="flex shrink-0 items-center" :data-testid="`${testid}-chip`">
    <UBadge
      color="primary"
      variant="soft"
      size="md"
      class="group/chip max-w-48 gap-0 rounded-full px-2.5 py-0.5 font-medium"
    >
      <span class="truncate">{{ name }}</span>
      <UButton
        square
        color="primary"
        variant="link"
        size="xs"
        icon="i-lucide-x"
        class="ms-0 w-0 overflow-hidden p-0 text-primary/70 opacity-0 group-hover/chip:ms-1 group-hover/chip:w-3.5 group-hover/chip:opacity-100 hover:text-primary focus-visible:ms-1 focus-visible:w-3.5 focus-visible:opacity-100"
        :aria-label="t('timer.mention.removeProject', { project: name })"
        :data-testid="`${testid}-chip-remove`"
        @click="emit('remove')"
      />
    </UBadge>
  </span>
</template>
