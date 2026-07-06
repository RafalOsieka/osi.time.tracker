<script setup lang="ts">
defineProps<{
  title: string;
  newLabel: string;
  newTestid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <div class="table-header">
    <span class="table-header-title">{{ title }}</span>
    <Button :label="newLabel" icon="pi pi-plus" :data-testid="newTestid" @click="emit('create')" />
  </div>
</template>

<style scoped>
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-header-title {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
