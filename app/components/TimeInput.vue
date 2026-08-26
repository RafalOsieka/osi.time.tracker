<script setup lang="ts">
const {
  modelValue,
  label = undefined,
  testid = undefined,
  id = undefined,
  describedby = undefined,
  invalid = false,
  compact = true,
} = defineProps<{
  modelValue: string | null;
  label?: string;
  testid?: string;
  id?: string;
  describedby?: string;
  invalid?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [string | null];
  commit: [];
  cancel: [];
}>();
const inputValue = ref(modelValue ?? '');
const previousValue = ref(modelValue ?? '');

watch(
  () => modelValue,
  (value) => {
    if (value !== previousValue.value) {
      inputValue.value = value ?? '';
      previousValue.value = value ?? '';
    }
  },
);

function commit() {
  const normalized = normalizeTimeInput(inputValue.value);
  if (normalized === null) {
    inputValue.value = previousValue.value;
  } else {
    inputValue.value = normalized;
    previousValue.value = normalized;
    if (normalized !== modelValue) emit('update:modelValue', normalized);
    emit('commit');
  }
}

function cancel() {
  inputValue.value = previousValue.value;
  emit('cancel');
}
</script>

<template>
  <UInput
    :id="id"
    v-model="inputValue"
    inputmode="numeric"
    class="time-input min-w-[10ch]"
    :class="{ 'time-input--compact w-full min-w-[10ch]': compact }"
    :size="compact ? 'xs' : undefined"
    :variant="compact ? 'outline' : undefined"
    :ui="
      compact
        ? {
            root: 'w-full min-w-0',
            base: 'w-full min-w-0 text-center text-sm/4 tabular-nums',
          }
        : undefined
    "
    :aria-label="label"
    :aria-describedby="describedby"
    :aria-invalid="invalid || undefined"
    :data-testid="testid"
    @blur="commit"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
  />
</template>
