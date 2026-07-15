/**
 * Normalizes free-form duration input (`H:MM:SS`, `H:MM`, or a bare number
 * of minutes) into a total number of seconds. Returns `null` for anything
 * that cannot be normalized (mirrors `normalizeTimeInput`'s revert-on-invalid
 * contract for the Remote Sync page's editable rounded duration).
 */
export function normalizeDurationInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const parts = value.split(':');
  if (parts.length === 0 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d+$/.test(part))) return null;

  const numbers = parts.map(Number);
  let hours = 0;
  let minutes: number;
  let seconds = 0;

  if (numbers.length === 1) {
    minutes = numbers[0]!;
  } else if (numbers.length === 2) {
    [hours, minutes] = numbers as [number, number];
  } else {
    [hours, minutes, seconds] = numbers as [number, number, number];
  }

  if (minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds;
}
