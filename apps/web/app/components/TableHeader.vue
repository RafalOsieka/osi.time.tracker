<script setup lang="ts">
/** The page header of a list page: its title and the button that creates a new item. */
const { quiet = false } = defineProps<{
  title: string;
  newLabel: string;
  newTestid: string;
  /**
   * Neutral outline instead of primary, for when an empty state below carries the page's one
   * primary action.
   */
  quiet?: boolean;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <PageHeader :title="title">
    <UButton
      :label="newLabel"
      icon="i-lucide-plus"
      :color="quiet ? 'neutral' : 'primary'"
      :variant="quiet ? 'outline' : 'solid'"
      :data-testid="newTestid"
      @click="emit('create')"
    />
  </PageHeader>
</template>
