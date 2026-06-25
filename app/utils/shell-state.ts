export type RailMode = 'full' | 'icon-only';

export function isValidRailMode(value: unknown): value is RailMode {
  return value === 'full' || value === 'icon-only';
}

export function resolveRailMode(value: unknown): RailMode {
  return isValidRailMode(value) ? value : 'full';
}
