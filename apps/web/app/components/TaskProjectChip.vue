<script setup lang="ts">
/**
 * The title input's Project chip (REQ-374): the Project's name as a small cyan pill with a
 * keyboard-operable remove control. `TaskTitleInput` places it before the text, or after it
 * in the top-bar timer.
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
      class="max-w-48 gap-1 rounded-full py-0.5 ps-2.5 pe-1 font-medium"
    >
      <span class="truncate">{{ name }}</span>
      <UButton
        square
        color="primary"
        variant="link"
        size="xs"
        icon="i-lucide-x"
        class="p-0 text-primary/70 hover:text-primary"
        :aria-label="t('timer.mention.removeProject', { project: name })"
        :data-testid="`${testid}-chip-remove`"
        @click="emit('remove')"
      />
    </UBadge>
  </span>
</template>
