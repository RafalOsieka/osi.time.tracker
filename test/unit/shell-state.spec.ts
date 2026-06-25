import { describe, expect, it } from 'vitest';
import { resolveRailMode, isValidRailMode } from '../../app/utils/shell-state';

describe('isValidRailMode', () => {
  it('returns true for valid modes', () => {
    expect(isValidRailMode('full')).toBe(true);
    expect(isValidRailMode('icon-only')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isValidRailMode(undefined)).toBe(false);
    expect(isValidRailMode(null)).toBe(false);
    expect(isValidRailMode('')).toBe(false);
    expect(isValidRailMode('collapsed')).toBe(false);
    expect(isValidRailMode(0)).toBe(false);
  });
});

describe('resolveRailMode', () => {
  it('returns full as default for unknown values', () => {
    expect(resolveRailMode(undefined)).toBe('full');
    expect(resolveRailMode(null)).toBe('full');
    expect(resolveRailMode('')).toBe('full');
    expect(resolveRailMode('invalid')).toBe('full');
  });

  it('returns the value when it is a valid RailMode', () => {
    expect(resolveRailMode('full')).toBe('full');
    expect(resolveRailMode('icon-only')).toBe('icon-only');
  });
});
