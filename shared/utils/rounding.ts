import type { RemoteRoundingRule } from '../types/remote-system-config';

/** Increment in seconds for every non-passthrough rounding rule. */
export const ROUNDING_INCREMENT_SECONDS: Record<Exclude<RemoteRoundingRule, 'none'>, number> = {
  up_15m: 15 * 60,
  up_30m: 30 * 60,
  up_1h: 60 * 60,
  nearest_15m: 15 * 60,
  nearest_30m: 30 * 60,
  nearest_1h: 60 * 60,
};

/**
 * Applies a Client's configured rounding rule to a summed duration, once.
 *
 * - `none` passes the total through unchanged.
 * - `up_15m` / `up_30m` / `up_1h` round **up** to the next multiple of the
 *   increment (exact multiples stay put).
 * - `nearest_15m` / `nearest_30m` / `nearest_1h` round to the closest multiple
 *   using half-up at the midpoint (`Math.round`).
 *
 * Never-round-to-zero guard: for any increment-based rule, a non-zero total
 * that would collapse to `0` is lifted to exactly one increment so the task
 * stays exportable. A genuine `0` total still returns `0`.
 *
 * Pure and reused by export so the pushed default equals the reviewed default.
 */
export function applyRoundingRule(totalSeconds: number, rule: RemoteRoundingRule): number {
  if (rule === 'none' || totalSeconds === 0) {
    return totalSeconds;
  }

  const increment = ROUNDING_INCREMENT_SECONDS[rule];
  const rounded = rule.startsWith('nearest_')
    ? Math.round(totalSeconds / increment) * increment
    : Math.ceil(totalSeconds / increment) * increment;

  // Never drop a non-zero total to zero (REQ-221).
  if (rounded === 0 && totalSeconds > 0) {
    return increment;
  }

  return rounded;
}

export type RoundingSuggestionKind = 'exact' | 'floor' | 'ceil';

export interface RoundingSuggestion {
  kind: RoundingSuggestionKind;
  seconds: number;
}

/**
 * One-tap export-duration alternatives for a manageable row (REQ-222).
 * Returns de-duplicated suggestions in `exact` → `floor` → `ceil` order.
 * For `none` only the exact selected total is offered.
 */
export function roundingSuggestionsFor(
  selectedSeconds: number,
  rule: RemoteRoundingRule,
): RoundingSuggestion[] {
  const exact = Math.max(0, selectedSeconds);

  if (rule === 'none') {
    return [{ kind: 'exact', seconds: exact }];
  }

  const increment = ROUNDING_INCREMENT_SECONDS[rule];
  const floor = Math.floor(exact / increment) * increment;
  const ceil = Math.ceil(exact / increment) * increment;

  const candidates: RoundingSuggestion[] = [
    { kind: 'exact', seconds: exact },
    { kind: 'floor', seconds: floor },
    { kind: 'ceil', seconds: ceil },
  ];

  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.seconds)) return false;
    seen.add(candidate.seconds);
    return true;
  });
}
