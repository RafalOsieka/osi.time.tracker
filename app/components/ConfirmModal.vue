<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmColor?: 'error' | 'primary' | 'neutral';
  }>(),
  {
    description: undefined,
    confirmLabel: undefined,
    cancelLabel: undefined,
    confirmColor: 'error',
  },
);

const emit = defineEmits<{
  close: [value: boolean];
}>();
</script>

<template>
  <UModal
    :title="props.title"
    :description="props.description"
    :dismissible="false"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #footer>
      <div class="flex justify-end gap-2" data-testid="confirm-modal">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="confirm-reject"
          :label="props.cancelLabel"
          @click="emit('close', false)"
        />
        <UButton
          :color="props.confirmColor"
          data-testid="confirm-accept"
          :label="props.confirmLabel"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
