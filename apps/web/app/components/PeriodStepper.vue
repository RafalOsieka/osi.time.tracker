<script setup lang="ts">
/**
 * One segmented control for stepping through days, months or other periods: previous, the
 * current period (the default slot, a plain label or a button that opens a calendar) and next.
 */
const { disabled = false, nextDisabled = false } = defineProps<{
  prevLabel: string;
  nextLabel: string;
  prevTestid: string;
  nextTestid: string;
  disabled?: boolean;
  /** Only the next step is unavailable. */
  nextDisabled?: boolean;
}>();

const emit = defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <UFieldGroup>
    <UTooltip :text="prevLabel" :content="{ side: 'top' }">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        square
        :disabled="disabled"
        :aria-label="prevLabel"
        :data-testid="prevTestid"
        @click="emit('prev')"
      />
    </UTooltip>
    <slot />
    <UTooltip :text="nextLabel" :content="{ side: 'top' }">
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        square
        :disabled="disabled || nextDisabled"
        :aria-label="nextLabel"
        :data-testid="nextTestid"
        @click="emit('next')"
      />
    </UTooltip>
  </UFieldGroup>
</template>
