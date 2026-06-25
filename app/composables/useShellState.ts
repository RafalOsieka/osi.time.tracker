import { resolveRailMode, type RailMode } from '~/utils/shell-state';

const COOKIE_KEY = 'shell_rail_mode';

export function useShellState() {
  const railMode = useCookie<RailMode>(COOKIE_KEY, {
    default: () => 'full',
    sameSite: 'lax',
    watch: 'shallow',
  });

  // useState ensures a single shared ref across all call sites (SSR + client).
  const mode = useState<RailMode>('shell-rail-mode', () => resolveRailMode(railMode.value));

  const toggle = () => {
    const next: RailMode = mode.value === 'full' ? 'icon-only' : 'full';
    mode.value = next;
    railMode.value = next;
  };

  const setMode = (value: RailMode) => {
    mode.value = value;
    railMode.value = value;
  };

  return {
    railMode: readonly(mode),
    toggle,
    setMode,
  };
}
