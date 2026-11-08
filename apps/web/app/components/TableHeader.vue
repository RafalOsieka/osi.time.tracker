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

/** Pressed looks like the button held down: the solid fill a step deeper, the outline one filled. */
const pressedClass = computed(() => {
  if (!pressed) return undefined;
  return quiet ? 'bg-elevated' : 'bg-primary/75 shadow-inner';
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
