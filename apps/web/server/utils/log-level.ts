import type { ConsolaInstance } from 'consola';

/** Numeric fallback matching consola's own default level (`info`), per REQ-357. */
export const DEFAULT_LOG_LEVEL = 3;

/**
 * Guards against consola's own `CONSOLA_LEVEL` parsing: it resolves the level with
 * `Number.parseInt(process.env.CONSOLA_LEVEL) ?? level`, and `??` only falls back on
 * `null`/`undefined` -- never on `NaN`. A non-numeric `CONSOLA_LEVEL` (e.g. a typo)
 * therefore leaves `consola.level` at `NaN`, and since every level comparison against
 * `NaN` is `false`, that silences every log line at every level, including errors.
 * Call once at startup to reset the level to the documented default when this happens
 * (server-logging REQ-357 "invalid level value falls back").
 */
export function ensureFiniteLogLevel(instance: Pick<ConsolaInstance, 'level'>): void {
  if (!Number.isFinite(instance.level)) {
    instance.level = DEFAULT_LOG_LEVEL;
  }
}
