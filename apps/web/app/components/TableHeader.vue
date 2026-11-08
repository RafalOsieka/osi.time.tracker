<script setup lang="ts">
/** The page header of a list page: its title and the button that creates a new item. */
const { quiet = false, pressed = false } = defineProps<{
  title: string;
  newLabel: string;
  newTestid: string;
  /**
   * Neutral outline instead of primary, for when an empty state below carries the page's one
   * primary action.
   */
  quiet?: boolean;
  /** The create dialog this button opened is open: the button shows its pressed state. */
  pressed?: boolean;
}>();

const emit = defineEmits<{ create: [] }>();

/**
 * Pressed looks like the button held down, and stays clear under a dialog's scrim: the solid fill
 * deeper (cyan-900 light, cyan-800 with white text dark) with a lighter inset ring, the outline
 * one filled with a cyan inset ring.
 */
const pressedClass = computed(() => {
  if (!pressed) return undefined;
  return quiet
    ? 'bg-accented ring-2 ring-inset ring-primary'
    : 'bg-(--ui-color-primary-900) ring-2 ring-inset ring-(--ui-color-primary-300) hover:bg-(--ui-color-primary-900) dark:bg-(--ui-color-primary-800) dark:text-white dark:ring-(--ui-color-primary-300) dark:hover:bg-(--ui-color-primary-800)';
});
</script>

<template>
  <PageHeader :title="title">
    <UButton
      :label="newLabel"
      icon="i-lucide-plus"
      :color="quiet ? 'neutral' : 'primary'"
      :variant="quiet ? 'outline' : 'solid'"
      :class="pressedClass"
      :aria-expanded="pressed"
      aria-haspopup="dialog"
      :data-testid="newTestid"
      @click="emit('create')"
    />
  </PageHeader>
</template>
