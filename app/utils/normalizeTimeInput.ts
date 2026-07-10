export function normalizeTimeInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const colon = value.endsWith(':') ? value.slice(0, -1) : value;
  if (colon.includes(':')) {
    const parts = colon.split(':');
    if (
      parts.length !== 2 ||
      (parts[0] !== '' && !/^\d+$/.test(parts[0]!)) ||
      !/^\d+$/.test(parts[1]!)
    )
      return null;
    const hour = parts[0] === '' ? 0 : Number(parts[0]);
    const minute = Number(parts[1]);
    return hour <= 23 && minute <= 59
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : null;
  }

  if (!/^\d+$/.test(colon)) return null;
  if (colon.length === 1) return `0${colon}:00`;
  if (colon.length === 2) {
    const number = Number(colon);
    if (number <= 23) return `${colon}:00`;
    return Number(colon[1]) <= 5 ? `0${colon[0]}:${colon[1]}0` : null;
  }
  if (colon.length === 3) {
    const hour = Number(colon[0]);
    const minute = Number(colon.slice(1));
    return hour <= 23 && minute <= 59
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : null;
  }
  if (colon.length === 4) {
    const hour = Number(colon.slice(0, 2));
    const minute = Number(colon.slice(2));
    return hour <= 23 && minute <= 59 ? `${colon.slice(0, 2)}:${colon.slice(2)}` : null;
  }
  return null;
}
