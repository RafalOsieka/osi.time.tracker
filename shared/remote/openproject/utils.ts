/**
 * Serializes whole seconds to an OpenProject ISO-8601 duration (`PT…H…M…S`).
 * Zero and negative inputs yield `PT0S`.
 */
export function formatOpenProjectDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  let out = 'PT';
  if (hours > 0) out += `${hours}H`;
  if (minutes > 0) out += `${minutes}M`;
  if (secs > 0 || (hours === 0 && minutes === 0)) out += `${secs}S`;
  return out;
}

/**
 * Parses an OpenProject ISO-8601 duration (`PT1H30M`, `PT45M`, `PT90S`, …)
 * into whole seconds. Returns `null` when the value cannot be parsed.
 */
export function parseOpenProjectDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (![hours, minutes, seconds].every((n) => Number.isFinite(n))) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function hrefId(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const match = /\/(\d+)(?:\?.*)?$/.exec(href);
  return match?.[1] ?? null;
}
