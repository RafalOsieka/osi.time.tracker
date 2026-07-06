<script setup lang="ts">
defineProps<{
  cancelLabel: string;
  saveLabel: string;
  saving: boolean;
}>();

const emit = defineEmits<{ cancel: [] }>();
</script>

<template>
  <div class="form-dialog-footer">
    <Button
      type="button"
      :label="cancelLabel"
      text
      data-testid="cancel-button"
      @click="emit('cancel')"
    />
    <Button type="submit" :label="saveLabel" :loading="saving" data-testid="save-button" />
  </div>
</template>

<style scoped>
.form-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
