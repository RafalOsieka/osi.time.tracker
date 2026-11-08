<script setup lang="ts">
const {
  title,
  description = undefined,
  confirmLabel = undefined,
  cancelLabel = undefined,
  confirmColor = 'error',
  icon = undefined,
  emphasis = undefined,
  onConfirm = undefined,
} = defineProps<{
  title: string;
  description?: string;
  /** The chip's glyph, e.g. the trash glyph of the tile that opened a delete confirm. */
  icon?: string;
  /** Text inside the description shown in medium weight, e.g. the name of what is deleted. */
  emphasis?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary' | 'neutral';
  onConfirm?: () => Promise<void> | void;
}>();

const emit = defineEmits<{
  close: [value: boolean];
}>();

const pending = shallowRef(false);

const chipIcon = computed(
  () => icon ?? (confirmColor === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-info'),
);

/** The description split around its first `emphasis` occurrence (whole text when absent). */
const descriptionParts = computed(() => {
  const text = description ?? '';
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return { before: text, strong: '', after: '' };
  return {
    before: text.slice(0, at),
    strong: emphasis,
    after: text.slice(at + emphasis.length),
  };
});

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
          <UIcon :name="chipIcon" class="size-5" />
        </span>
        <p class="m-0 pt-1.5 text-sm text-toned" data-testid="confirm-description">
          <!-- Each part in its own element, so line breaks in the template add no spaces. -->
          <span v-text="descriptionParts.before" />
          <strong
            v-if="descriptionParts.strong"
            class="font-medium text-highlighted"
            v-text="descriptionParts.strong"
          />
          <span v-text="descriptionParts.after" />
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
