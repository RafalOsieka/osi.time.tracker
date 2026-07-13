/**
 * Formats an ISO timestamp string for display in a table, honoring the
 * active i18n locale. Returns an empty string for empty or unparsable input
 * instead of rendering "Invalid Date".
 */
export function formatDate(
  iso: string,
  locale: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { timeZone });
}
