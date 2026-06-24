import { describe, expect, it } from 'vitest';
import { resolveEffectiveMode } from '../../app/utils/color-mode';

describe('resolveEffectiveMode', () => {
  it('returns light when preference is light', () => {
    expect(resolveEffectiveMode('light', false)).toBe('light');
    expect(resolveEffectiveMode('light', true)).toBe('light');
  });

  it('returns dark when preference is dark', () => {
    expect(resolveEffectiveMode('dark', false)).toBe('dark');
    expect(resolveEffectiveMode('dark', true)).toBe('dark');
  });

  it('maps system to the current system preference', () => {
    expect(resolveEffectiveMode('system', false)).toBe('light');
    expect(resolveEffectiveMode('system', true)).toBe('dark');
  });
});
