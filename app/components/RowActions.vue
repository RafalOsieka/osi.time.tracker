<script setup lang="ts">
defineProps<{
  editLabel: string;
  deleteLabel: string;
  editTestid: string;
  deleteTestid: string;
}>();

const emit = defineEmits<{ edit: []; delete: [] }>();
</script>

<template>
  <div class="flex gap-1">
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="ghost"
      square
      :aria-label="editLabel"
      :data-testid="editTestid"
      @click="emit('edit')"
    />
    <UButton
      icon="i-lucide-trash-2"
      color="error"
      variant="ghost"
      square
      :aria-label="deleteLabel"
      :data-testid="deleteTestid"
      @click="emit('delete')"
    />
  </div>
</template>
