export type ColorModePreference = 'light' | 'dark' | 'system';
export type EffectiveColorMode = 'light' | 'dark';

export function resolveEffectiveMode(
  stored: ColorModePreference,
  systemPrefersDark: boolean,
): EffectiveColorMode {
  if (stored === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return stored;
}
