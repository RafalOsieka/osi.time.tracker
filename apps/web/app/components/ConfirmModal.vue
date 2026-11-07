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
  <UModal :title="title" :dismissible="!pending" :close="!pending">
    <template v-if="description" #body>
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-md"
          :class="
            confirmColor === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
          "
          aria-hidden="true"
        >
          <UIcon
            :name="confirmColor === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
            class="size-5"
          />
        </span>
        <p class="m-0 pt-1.5 text-sm text-toned" data-testid="confirm-description">
          {{ description }}
        </p>
      </div>
    </template>
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
