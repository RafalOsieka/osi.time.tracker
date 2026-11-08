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
  const seconds = normalizeDurationInput(inputValue.value);
  const normalized = seconds === null ? null : formatDuration(seconds);
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

const DEFAULT_UI = {
  root: 'inline-flex w-[8ch]',
  base: 'w-full px-0 py-0 font-mono text-sm font-medium tabular-nums text-muted',
};
const COMPACT_UI = {
  root: 'inline-flex w-[calc(8ch+0.75rem)] font-mono text-sm',
  base: 'w-full rounded-md bg-default px-1.5 py-1 text-end font-mono text-sm/4 tabular-nums text-highlighted ring ring-inset ring-primary dark:bg-muted',
};
</script>

<template>
  <!-- Compact (Remote sync's to-send editor) it keeps the at-rest frame's size and tone, with
       the 3:1 outline turned cyan while it has focus, so starting to edit moves nothing. -->
  <UInput
    :id="id"
    v-model="inputValue"
    inputmode="numeric"
    class="time-input"
    :class="{ 'time-input--compact': compact }"
    :size="compact ? 'xs' : undefined"
    :variant="compact ? 'none' : undefined"
    :ui="compact ? COMPACT_UI : DEFAULT_UI"
    :aria-label="label"
    :aria-describedby="describedby"
    :aria-invalid="invalid || undefined"
    :data-testid="testid"
    @blur="commit"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
  />
</template>
