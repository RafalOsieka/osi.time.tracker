<script setup lang="ts">
import { FormField } from '@primevue/forms';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    label: string;
    name: string;
    errorTestid: string;
    serverError?: string;
    inputId?: string;
  }>(),
  { serverError: '', inputId: '' },
);

const labelFor = computed(() => props.inputId || props.name);

const { t } = useI18n();
</script>

<template>
  <FormField v-slot="$field" :name="name" class="form-field-wrap">
    <label :for="labelFor">{{ label }}</label>
    <slot :field="{ ...$field, invalid: !!($field?.invalid || serverError) }" />
    <Message
      v-if="serverError || $field?.invalid"
      :id="errorTestid"
      severity="error"
      size="small"
      variant="simple"
      role="alert"
      :data-testid="errorTestid"
    >
      {{ serverError || t($field.error?.message) }}
    </Message>
  </FormField>
</template>

<style scoped>
.form-field-wrap {
  display: grid;
  gap: 0.375rem;
}
</style>
