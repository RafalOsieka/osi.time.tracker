<script setup lang="ts">
defineProps<{
  title: string;
  newLabel: string;
  newTestid: string;
}>();

const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <span class="text-xl font-semibold">{{ title }}</span>
    <UButton
      :label="newLabel"
      icon="i-lucide-plus"
      :data-testid="newTestid"
      @click="emit('create')"
    />
  </div>
</template>
