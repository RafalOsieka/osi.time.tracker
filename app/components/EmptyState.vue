<script setup lang="ts">
defineProps<{
  message: string;
  ctaLabel: string;
  testid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <div class="empty-state" :data-testid="testid">
    <p>{{ message }}</p>
    <Button
      :label="ctaLabel"
      icon="pi pi-plus"
      data-testid="empty-state-cta"
      @click="emit('create')"
    />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}
</style>
