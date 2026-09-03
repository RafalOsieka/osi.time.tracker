<script setup lang="ts">
/**
 * Click-to-edit text: plain `UInput` until focused, then ghost variant.
 * Parent owns the value and when editing is active.
 */
const {
  modelValue,
  editing,
  fieldLabel,
  displayTestid,
  inputTestid,
  placeholder = '',
  displayClass = '',
  displayValue = undefined,
  disabled = false,
} = defineProps<{
  modelValue: string;
  editing: boolean;
  fieldLabel: string;
  displayTestid: string;
  inputTestid: string;
  placeholder?: string;
  displayClass?: string;
  displayValue?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  edit: [];
  commit: [];
  cancel: [];
}>();

const rootClass = 'min-w-0 w-full max-w-full';
const slotInputUi = { root: 'min-w-0 w-full max-w-full', base: 'min-w-0 truncate' };
const shownValue = computed(() => displayValue ?? modelValue);

function onInput(value: string | undefined) {
  emit('update:modelValue', value ?? '');
}

function onEdit() {
  if (disabled) return;
  emit('edit');
}
</script>

<template>
  <div :class="rootClass">
    <UInput
      v-if="editing"
      :model-value="modelValue"
      variant="ghost"
      size="xs"
      class="w-full min-w-0 max-w-full"
      :ui="slotInputUi"
      :placeholder="placeholder"
      :aria-label="fieldLabel"
      :data-testid="inputTestid"
      @update:model-value="onInput"
      @blur="emit('commit')"
      @keydown.enter="emit('commit')"
      @keydown.esc.prevent="emit('cancel')"
    />
    <OverflowTooltip v-else :text="shownValue">
      <UInput
        :model-value="shownValue"
        variant="none"
        readonly
        size="xs"
        class="w-full min-w-0 max-w-full"
        :class="[displayClass, disabled ? 'cursor-default' : 'cursor-pointer']"
        :ui="slotInputUi"
        :aria-label="fieldLabel"
        :data-testid="displayTestid"
        @focus="onEdit"
        @click.stop="onEdit"
      />
    </OverflowTooltip>
  </div>
</template>
