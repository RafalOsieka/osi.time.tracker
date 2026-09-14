import { describe, it, expect } from 'vitest';
import { ensureFiniteLogLevel, DEFAULT_LOG_LEVEL } from '../../server/utils/log-level';

describe('ensureFiniteLogLevel', () => {
  it('leaves a numeric level (set from a valid CONSOLA_LEVEL) untouched', () => {
    const instance = { level: 4 };
    ensureFiniteLogLevel(instance);
    expect(instance.level).toBe(4);
  });

  it('leaves level 0 (a valid, falsy level) untouched', () => {
    const instance = { level: 0 };
    ensureFiniteLogLevel(instance);
    expect(instance.level).toBe(0);
  });

  it('resets NaN (a non-numeric CONSOLA_LEVEL, e.g. consola parsing "debug") to the default', () => {
    const instance = { level: Number.NaN };
    ensureFiniteLogLevel(instance);
    expect(instance.level).toBe(DEFAULT_LOG_LEVEL);
  });

  it('resets Infinity to the default', () => {
    const instance = { level: Number.POSITIVE_INFINITY };
    ensureFiniteLogLevel(instance);
    expect(instance.level).toBe(DEFAULT_LOG_LEVEL);
  });
});
