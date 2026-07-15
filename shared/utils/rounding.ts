import type { RemoteRoundingRule } from '../types/remote-system-config';

const ROUNDING_INCREMENT_SECONDS: Record<Exclude<RemoteRoundingRule, 'none'>, number> = {
  up_15m: 15 * 60,
  up_30m: 30 * 60,
  up_1h: 60 * 60,
};

/**
 * Applies a Client's configured rounding rule to a summed duration, once.
 * `none` passes the total through unchanged; `up_15m`/`up_30m`/`up_1h` round
 * **up** to the next multiple of the increment, leaving exact multiples
 * unchanged and `0` staying `0`. Pure and reused verbatim by story 11b so
 * the pushed default always equals the reviewed default.
 */
export function applyRoundingRule(totalSeconds: number, rule: RemoteRoundingRule): number {
  if (rule === 'none' || totalSeconds === 0) {
    return totalSeconds;
  }

  const increment = ROUNDING_INCREMENT_SECONDS[rule];
  return Math.ceil(totalSeconds / increment) * increment;
}
