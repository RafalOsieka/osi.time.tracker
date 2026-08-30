/** Formats a duration in seconds as unpadded `H:MM`, flooring leftover seconds. */
export function formatReportDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const totalMinutes = Math.floor(total / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}
