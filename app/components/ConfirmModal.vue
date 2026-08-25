<script setup lang="ts">
const {
  title,
  description = undefined,
  confirmLabel = undefined,
  cancelLabel = undefined,
  confirmColor = 'error',
} = defineProps<{
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary' | 'neutral';
}>();

const emit = defineEmits<{
  close: [value: boolean];
}>();
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="false"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #footer>
      <div class="flex justify-end gap-2" data-testid="confirm-modal">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="confirm-reject"
          :label="cancelLabel"
          @click="emit('close', false)"
        />
        <UButton
          :color="confirmColor"
          data-testid="confirm-accept"
          :label="confirmLabel"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
