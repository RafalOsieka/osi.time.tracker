<script setup lang="ts">
/**
 * The action row at the foot of a form dialog's body: cancel and submit, right-aligned. It sits
 * inside the `UForm` (the submit button must), so it bleeds to the dialog's edges and draws the
 * same divider and padding as `UModal`'s own footer, which confirmations use.
 */
defineProps<{
  cancelLabel: string;
  saveLabel: string;
  saving: boolean;
}>();

const emit = defineEmits<{ cancel: [] }>();
</script>

<template>
  <div
    class="-mx-4 -mb-4 mt-2 flex justify-end gap-2 border-t border-default p-4 sm:-mx-6 sm:-mb-6 sm:px-6"
  >
    <UButton
      type="button"
      color="neutral"
      variant="outline"
      :label="cancelLabel"
      data-testid="cancel-button"
      @click="emit('cancel')"
    />
    <UButton type="submit" :label="saveLabel" :loading="saving" data-testid="save-button" />
  </div>
</template>
