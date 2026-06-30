import {
  resolveEffectiveMode,
  type ColorModePreference,
  type EffectiveColorMode,
} from '~/utils/color-mode';

const COOKIE_KEY = 'color_mode';

export function useColorMode() {
  const preference = useCookie<ColorModePreference>(COOKIE_KEY, {
    default: () => 'system',
    sameSite: 'lax',
    watch: 'shallow',
  });

  // useState ensures a single shared ref across all call sites (plugin, component, etc.).
  // `false` is passed for systemPrefersDark on init because window is not available during
  // SSR; the plugin re-applies the correct value on the client via applyFromPreference().
  const effectiveMode = useState<EffectiveColorMode>('color-mode-effective', () =>
    resolveEffectiveMode(preference.value ?? 'system', false),
  );

  const applyClass = (mode: EffectiveColorMode) => {
    if (import.meta.server) {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
  };

  const applyFromPreference = () => {
    const systemPrefersDark =
      import.meta.client && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = resolveEffectiveMode(preference.value ?? 'system', systemPrefersDark);
    effectiveMode.value = mode;
    applyClass(mode);
  };

  const setPreference = (value: ColorModePreference) => {
    preference.value = value;
    applyFromPreference();
  };

  return {
    preference,
    effectiveMode: readonly(effectiveMode),
    setPreference,
    applyFromPreference,
  };
}
