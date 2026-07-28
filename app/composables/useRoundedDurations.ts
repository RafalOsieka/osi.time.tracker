import { ref } from 'vue';
import {
  applyRoundingRule,
  roundingSuggestionsFor,
  type RoundingSuggestion,
} from '../../shared/utils/rounding';
import type { RemoteRoundingRule } from '../../shared/types/remote-system-config';
import { formatDuration } from '../utils/formatDuration';
import { normalizeDurationInput } from '../utils/normalizeDurationInput';

/**
 * Rounded-duration overrides + raw input text with commit/revert semantics (REQ-113).
 */
export function useRoundedDurations() {
  const overrides = ref<Record<string, number>>({});
  const inputText = ref<Record<string, string>>({});

  function computedSeconds(
    taskId: string,
    selectedSeconds: number,
    roundingRule: RemoteRoundingRule,
  ) {
    if (taskId in overrides.value) {
      return overrides.value[taskId]!;
    }
    return applyRoundingRule(selectedSeconds, roundingRule);
  }

  function displayedInput(
    taskId: string,
    selectedSeconds: number,
    roundingRule: RemoteRoundingRule,
  ): string {
    return (
      inputText.value[taskId] ??
      formatDuration(computedSeconds(taskId, selectedSeconds, roundingRule))
    );
  }

  function setInput(taskId: string, value: string | undefined) {
    inputText.value = { ...inputText.value, [taskId]: value ?? '' };
  }

  function commit(taskId: string, selectedSeconds: number, roundingRule: RemoteRoundingRule): void {
    const raw =
      inputText.value[taskId] ??
      formatDuration(computedSeconds(taskId, selectedSeconds, roundingRule));
    const seconds = normalizeDurationInput(raw);
    if (seconds === null) {
      inputText.value = {
        ...inputText.value,
        [taskId]: formatDuration(computedSeconds(taskId, selectedSeconds, roundingRule)),
      };
      return;
    }
    overrides.value = { ...overrides.value, [taskId]: seconds };
    inputText.value = { ...inputText.value, [taskId]: formatDuration(seconds) };
  }

  /**
   * Sets an explicit per-task export-duration override (used by one-tap
   * rounding suggestions and any other non-typed entry point).
   */
  function applyOverride(taskId: string, seconds: number): void {
    const safe = Math.max(0, Math.floor(seconds));
    overrides.value = { ...overrides.value, [taskId]: safe };
    inputText.value = { ...inputText.value, [taskId]: formatDuration(safe) };
  }

  function reset(taskId: string) {
    overrides.value = Object.fromEntries(
      Object.entries(overrides.value).filter(([id]) => id !== taskId),
    );
    inputText.value = Object.fromEntries(
      Object.entries(inputText.value).filter(([id]) => id !== taskId),
    );
  }

  function hasOverride(taskId: string): boolean {
    return taskId in overrides.value;
  }

  /**
   * One-tap alternatives for the editable export duration (REQ-222).
   * Pure derivation from selected total + rule; `taskId` is accepted so
   * call sites stay consistent with the rest of this composable.
   */
  function suggestionsFor(
    _taskId: string,
    selectedSeconds: number,
    rule: RemoteRoundingRule,
  ): RoundingSuggestion[] {
    return roundingSuggestionsFor(selectedSeconds, rule);
  }

  return {
    overrides,
    inputText,
    computedSeconds,
    displayedInput,
    setInput,
    commit,
    applyOverride,
    reset,
    hasOverride,
    suggestionsFor,
  };
}
