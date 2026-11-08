<script setup lang="ts">
/**
 * Click-to-edit text: a read-only `UInput` until focused, then an editable one.
 * Parent owns the value and when editing is active. Unframed (the Timer's titles) it shows no
 * chrome at rest; `framed` (Remote sync's title to send) gives it the quiet editable frame of the
 * Timer's time editors at rest, filling its column, and the same frame with a cyan ring while
 * editing, so the value never jumps between the two states.
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
  framed = false,
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
  framed?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  edit: [];
  commit: [];
  cancel: [];
}>();

const rootClass = '-ms-2 min-w-0 w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)]';
const slotInputUi = { root: 'min-w-0 w-full max-w-full', base: 'min-w-0 truncate md:text-sm/4' };
/**
 * The frame: a card-tone field with the 3:1 control outline, as wide as its column (so a column
 * of them reads as aligned fields, not ragged chips), tinted on hover and ringed in cyan while
 * editing.
 */
const FRAME =
  'w-full rounded-md bg-default py-1.5 ring ring-inset ring-accented transition-shadow dark:bg-muted';
const editUi = computed(() =>
  framed ? { ...slotInputUi, base: `${slotInputUi.base} ${FRAME} ring-primary` } : slotInputUi,
);
// `displayClass` goes on the input itself: UInput sets its own text color there.
const displayUi = computed(() => ({
  ...slotInputUi,
  base: `${slotInputUi.base} ${framed ? `${FRAME} hover:bg-elevated dark:hover:bg-elevated` : ''} ${displayClass}`,
}));
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
      :variant="framed ? 'none' : 'ghost'"
      size="xs"
      class="w-full min-w-0 max-w-full"
      :ui="editUi"
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
        :class="disabled ? 'cursor-default' : 'cursor-pointer'"
        :ui="displayUi"
        :aria-label="fieldLabel"
        :data-testid="displayTestid"
        @focus="onEdit"
        @click.stop="onEdit"
      />
    </OverflowTooltip>
  </div>
</template>
