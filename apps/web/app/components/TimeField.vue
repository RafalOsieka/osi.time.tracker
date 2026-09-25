<script setup lang="ts">
import {
  CalendarDate,
  type Time,
  type CalendarDateTime,
  ZonedDateTime,
} from '@internationalized/date';

/** The value kinds Nuxt UI's `UInputTime` speaks: a plain time, or a date-time with or without a zone. */
type TimeValue = Time | CalendarDateTime | ZonedDateTime;
/** Nuxt UI's range shape: either side may be absent while the field is incomplete. */
type TimeFieldRange = { start: TimeValue | undefined; end: TimeValue | undefined };

/**
 * Shared segmented clock-time field (REQ-361, shared-ui-components): a thin
 * wrapper around Nuxt UI's `UInputTime` that always presents a 24-hour clock
 * with hour/minute segments, adds an inline draft/commit/cancel contract for
 * click-to-edit call sites, and can clamp a same-minute inversion in range
 * mode. The wrapper never converts to or from instants — callers hold
 * whatever `@internationalized/date` value fits their own boundary (a
 * `ZonedDateTime` seeded from an instant, or a plain `Time`).
 *
 * `modelValue` is a plain union rather than a `range`-discriminated generic:
 * `UInputTime` itself only preserves that discrimination at its public type
 * declaration and falls back to an untyped model internally, and mirroring
 * that here keeps this wrapper's template binding straightforward.
 */
const {
  modelValue,
  range = false,
  clampSeconds = false,
  size = undefined,
  variant = undefined,
  ui = undefined,
  disabled = false,
  id = undefined,
  label = undefined,
  separator = undefined,
  invalid = false,
  describedby = undefined,
  testid = undefined,
} = defineProps<{
  modelValue: TimeValue | TimeFieldRange | null;
  range?: boolean;
  /** Snap a same-minute inverted range to a zero-length range on commit (range mode only). Default off. */
  clampSeconds?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'outline' | 'soft' | 'subtle' | 'ghost' | 'none';
  ui?: { base?: string };
  disabled?: boolean;
  id?: string;
  /** Accessible label for the whole field (both segments in range mode). */
  label?: string;
  /** Text shown between the start and end segment groups (range mode only). */
  separator?: string;
  invalid?: boolean;
  describedby?: string;
  testid?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [TimeValue | TimeFieldRange | null];
  /** Fired on Enter or on focus leaving the whole field, unless the value is unchanged. */
  commit: [];
  /** Fired on Escape; the field has already reverted to the last committed value. */
  cancel: [];
}>();

function isRangeValue(value: TimeValue | TimeFieldRange | null): value is TimeFieldRange {
  return value !== null && typeof value === 'object' && 'start' in value;
}

/**
 * Compares two `TimeValue`s chronologically (negative when `a` is earlier).
 * Both sides of one field are always the same concrete kind, so a missing
 * date part (a plain `Time`) compares equal on that part for both. Written
 * by hand rather than via `.compare()`, which exists identically on `Time`,
 * `CalendarDateTime`, and `ZonedDateTime` but whose call signature
 * TypeScript cannot unify across their union.
 */
function compareTimeValues(a: TimeValue, b: TimeValue): number {
  const aYear = 'year' in a ? a.year : 0;
  const bYear = 'year' in b ? b.year : 0;
  const aMonth = 'year' in a ? a.month : 0;
  const bMonth = 'year' in b ? b.month : 0;
  const aDay = 'year' in a ? a.day : 0;
  const bDay = 'year' in b ? b.day : 0;
  return (
    aYear - bYear ||
    aMonth - bMonth ||
    aDay - bDay ||
    a.hour - b.hour ||
    a.minute - b.minute ||
    a.second - b.second ||
    a.millisecond - b.millisecond
  );
}

function timeValueEquals(a: TimeValue | null | undefined, b: TimeValue | null | undefined) {
  if (a == null || b == null) return a == null && b == null;
  return compareTimeValues(a, b) === 0;
}

function modelEquals(
  a: TimeValue | TimeFieldRange | null,
  b: TimeValue | TimeFieldRange | null,
): boolean {
  if (isRangeValue(a) || isRangeValue(b)) {
    if (!isRangeValue(a) || !isRangeValue(b)) return false;
    return timeValueEquals(a.start, b.start) && timeValueEquals(a.end, b.end);
  }
  return timeValueEquals(a, b);
}

function isSameMinute(a: TimeValue, b: TimeValue): boolean {
  if (a.hour !== b.hour || a.minute !== b.minute) return false;
  const aDate = 'year' in a ? a : null;
  const bDate = 'year' in b ? b : null;
  if (Boolean(aDate) !== Boolean(bDate)) return false;
  if (!aDate || !bDate) return true;
  return aDate.year === bDate.year && aDate.month === bDate.month && aDate.day === bDate.day;
}

function withSecondAndMillisecond(value: TimeValue, from: TimeValue): TimeValue {
  // SAFETY: `.set()` exists identically on `Time`, `CalendarDateTime`, and
  // `ZonedDateTime` (all fields optional), but TypeScript synthesizes an
  // unusable intersection for a call through their union — this narrow cast
  // is a no-op at runtime.
  const setter = value.set as (fields: { second: number; millisecond: number }) => TimeValue;
  return setter.call(value, { second: from.second, millisecond: from.millisecond });
}

const draft = shallowRef<TimeValue | TimeFieldRange | null>(modelValue);
const lastCommitted = shallowRef<TimeValue | TimeFieldRange | null>(draft.value);
const editedSide = ref<'start' | 'end' | null>(null);
let pendingBlur: ReturnType<typeof setTimeout> | undefined;

function hasOffsetTransition(value: TimeValue | null | undefined): boolean {
  if (!(value instanceof ZonedDateTime)) return false;
  const date = new CalendarDate(value.year, value.month, value.day);
  const start = date.toDate(value.timeZone);
  const end = date.add({ days: 1 }).toDate(value.timeZone);
  return end.getTime() - start.getTime() !== 24 * 60 * 60 * 1000;
}

const hideTimeZone = computed(() => {
  const value = draft.value;
  return isRangeValue(value)
    ? !hasOffsetTransition(value.start) && !hasOffsetTransition(value.end)
    : !hasOffsetTransition(value);
});

function clearPendingBlur() {
  if (pendingBlur !== undefined) clearTimeout(pendingBlur);
  pendingBlur = undefined;
}

onBeforeUnmount(clearPendingBlur);

watch(
  () => modelValue,
  (value) => {
    // A `v-model` consumer re-passes whatever we just emitted as its own new
    // `modelValue`; that echo must not resync `draft` mid-edit, so this
    // compares against the field's own current draft, not `lastCommitted`
    // (which the consumer's commit handler may not have moved yet, or may
    // never move on a failed request — this fires either way).
    if (modelEquals(value, draft.value)) return;
    draft.value = value;
    lastCommitted.value = value;
  },
);

function onUpdate(value: TimeValue | TimeFieldRange | null | undefined) {
  const next = value ?? null;
  if (isRangeValue(next)) {
    const previous = isRangeValue(draft.value) ? draft.value : null;
    const startChanged = !timeValueEquals(previous?.start, next.start);
    const endChanged = !timeValueEquals(previous?.end, next.end);
    if (startChanged && !endChanged) editedSide.value = 'start';
    else if (endChanged && !startChanged) editedSide.value = 'end';
  }
  draft.value = next;
  emit('update:modelValue', next);
}

/** Snaps a same-minute inverted range to a zero-length range, per REQ-361. */
function clampInversion(value: TimeFieldRange): TimeFieldRange {
  const { start, end } = value;
  if (!start || !end) return value;
  if (!isSameMinute(start, end) || compareTimeValues(start, end) <= 0) return value;

  return editedSide.value === 'end'
    ? { start, end: withSecondAndMillisecond(end, start) }
    : { start: withSecondAndMillisecond(start, end), end };
}

function commit() {
  clearPendingBlur();
  let next = draft.value;
  if (range && clampSeconds && isRangeValue(next)) {
    const clamped = clampInversion(next);
    if (clamped !== next) {
      next = clamped;
      draft.value = next;
      emit('update:modelValue', next);
    }
  }

  if (modelEquals(next, lastCommitted.value)) return;
  lastCommitted.value = next;
  emit('commit');
}

function cancel() {
  clearPendingBlur();
  draft.value = lastCommitted.value;
  emit('update:modelValue', draft.value);
  emit('cancel');
}

/**
 * Decide after the focus transition settles, including when relatedTarget is
 * absent. The field's own element comes from the event rather than a template
 * ref on `UInputTime`: that component renders two root nodes, so its `$el` is
 * a fragment anchor that contains none of the segments.
 */
function onFocusOut(event: FocusEvent) {
  const root = event.currentTarget;
  clearPendingBlur();
  pendingBlur = setTimeout(() => {
    pendingBlur = undefined;
    if (!(root instanceof Node) || !root.contains(document.activeElement)) commit();
  }, 0);
}
</script>

<template>
  <UInputTime
    :id="id"
    :model-value="draft"
    :range="range"
    :hide-time-zone="hideTimeZone"
    :hour-cycle="24"
    granularity="minute"
    :size="size"
    :variant="variant"
    :ui="ui"
    :disabled="disabled"
    :aria-label="label"
    :aria-invalid="invalid || undefined"
    :aria-describedby="describedby"
    :data-testid="testid"
    class="w-full"
    @update:model-value="onUpdate"
    @focusout="onFocusOut"
    @keydown.enter.prevent="commit"
    @keydown.esc.prevent="cancel"
  >
    <template v-if="range" #separator>{{ separator }}</template>
  </UInputTime>
</template>
