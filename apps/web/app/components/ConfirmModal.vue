<script setup lang="ts">
const {
  title,
  description = undefined,
  confirmLabel = undefined,
  cancelLabel = undefined,
  confirmColor = 'error',
  onConfirm = undefined,
} = defineProps<{
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary' | 'neutral';
  onConfirm?: () => Promise<void> | void;
}>();

const emit = defineEmits<{
  close: [value: boolean];
}>();

const pending = shallowRef(false);

async function accept() {
  if (pending.value) return;
  pending.value = true;
  try {
    await onConfirm?.();
    emit('close', true);
  } catch {
    pending.value = false;
  }
}

function reject() {
  if (pending.value) return;
  emit('close', false);
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :dismissible="!pending"
    :close="!pending"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #footer>
      <div class="flex justify-end gap-2" data-testid="confirm-modal">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="confirm-reject"
          :disabled="pending"
          :label="cancelLabel"
          @click="reject"
        />
        <UButton
          :color="confirmColor"
          data-testid="confirm-accept"
          :loading="pending"
          :label="confirmLabel"
          @click="accept"
        />
      </div>
    </template>
  </UModal>
</template>
