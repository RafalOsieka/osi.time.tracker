/** Formats a duration given in seconds as `HH:MM:SS`. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Formats a signed duration delta as `+HH:MM:SS` / `−HH:MM:SS` / `00:00:00`. */
export function formatSignedDuration(deltaSeconds: number): string {
  if (deltaSeconds === 0) return formatDuration(0);
  const sign = deltaSeconds > 0 ? '+' : '−';
  return `${sign}${formatDuration(Math.abs(deltaSeconds))}`;
}

/** Formats an ISO timestamp as a locale-aware time (HH:MM). */
export function formatTime(
  iso: string,
  locale: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone });
}
