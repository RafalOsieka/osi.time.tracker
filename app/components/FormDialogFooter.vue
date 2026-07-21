<script setup lang="ts">
defineProps<{
  cancelLabel: string;
  saveLabel: string;
  saving: boolean;
}>();

const emit = defineEmits<{ cancel: [] }>();
</script>

<template>
  <div class="flex justify-end gap-2">
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      :label="cancelLabel"
      data-testid="cancel-button"
      @click="emit('cancel')"
    />
    <UButton type="submit" :label="saveLabel" :loading="saving" data-testid="save-button" />
  </div>
</template>
