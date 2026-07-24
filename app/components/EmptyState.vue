<script setup lang="ts">
defineProps<{
  message: string;
  ctaLabel: string;
  testid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <div class="flex flex-col items-center gap-4 p-8" :data-testid="testid">
    <p class="text-muted">{{ message }}</p>
    <UButton
      :label="ctaLabel"
      icon="i-lucide-plus"
      data-testid="empty-state-cta"
      @click="emit('create')"
    />
  </div>
</template>
