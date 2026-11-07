<script setup lang="ts">
/** The page header of a list page: its title and the button that creates a new item. */
defineProps<{
  title: string;
  newLabel: string;
  newTestid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <PageHeader :title="title">
    <UButton
      :label="newLabel"
      icon="i-lucide-plus"
      :data-testid="newTestid"
      @click="emit('create')"
    />
  </PageHeader>
</template>
