<script setup lang="ts">
const {
  modelValue,
  label = undefined,
  testid = undefined,
  id = undefined,
  describedby = undefined,
  invalid = false,
  compact = true,
  duration = false,
} = defineProps<{
  modelValue: string | null;
  label?: string;
  testid?: string;
  id?: string;
  describedby?: string;
  invalid?: boolean;
  compact?: boolean;
  /** Normalize as `HH:MM:SS` duration instead of clock `HH:mm`. */
  duration?: boolean;
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

function normalize(raw: string): string | null {
  if (!duration) return normalizeTimeInput(raw);
  const seconds = normalizeDurationInput(raw);
  return seconds === null ? null : formatDuration(seconds);
}

function commit() {
  const normalized = normalize(inputValue.value);
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
    class="time-input"
    :class="
      duration
        ? { 'time-input--compact': compact }
        : { 'min-w-[10ch]': true, 'time-input--compact w-full min-w-[10ch]': compact }
    "
    :size="compact ? 'xs' : undefined"
    :variant="compact ? 'outline' : undefined"
    :ui="
      duration
        ? {
            root: 'inline-flex w-[8ch]',
            base: 'w-full px-0 py-0 font-mono text-sm font-medium tabular-nums text-muted',
          }
        : compact
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
