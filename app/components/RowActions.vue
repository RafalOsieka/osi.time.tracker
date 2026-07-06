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
  <div class="row-actions">
    <Button
      icon="pi pi-pencil"
      text
      rounded
      :aria-label="editLabel"
      :data-testid="editTestid"
      @click="emit('edit')"
    />
    <Button
      icon="pi pi-trash"
      text
      rounded
      severity="danger"
      :aria-label="deleteLabel"
      :data-testid="deleteTestid"
      @click="emit('delete')"
    />
  </div>
</template>

<style scoped>
.row-actions {
  display: flex;
  gap: 0.25rem;
}
</style>
