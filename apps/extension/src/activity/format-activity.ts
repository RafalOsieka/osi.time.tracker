import type { ExtensionLocale, MessageParams } from '../i18n/translate.js';
import type { ActivityRecord } from './activity-store.js';

type Translate = (key: string, params?: MessageParams) => string;

/** "now", "3 minutes ago" (or "3 min ago" when short), "yesterday"… in the extension's language. */
export function relativeTime(
  at: string,
  now: number,
  locale: ExtensionLocale,
  style: Intl.RelativeTimeFormatStyle = 'long',
): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style });
  const seconds = Math.round((Date.parse(at) - now) / 1000);
  if (Math.abs(seconds) < 45) return format.format(0, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}

/** A destination's latest operation, split for a row: its outcome, what ran, and when. */
export interface ActivitySummary {
  ok: boolean;
  /** "Succeeded", "Timed out"… */
  outcome: string;
  /** "Time entry export" */
  operation: string;
  /** "Time entry export failed", worded per operation so Polish agrees in gender */
  failure: string;
  /** "4 minutes ago", with non-breaking spaces so it never splits across lines. */
  when: string;
}

/**
 * Summarizes a record for a row. `compact` (the narrow popup) takes the short time and the short
 * failure phrase, so a failure keeps the same one-line layout as a success.
 */
export function summarizeActivity(
  record: ActivityRecord,
  now: number,
  locale: ExtensionLocale,
  t: Translate,
  compact = false,
): ActivitySummary {
  return {
    ok: record.outcome === 'ok',
    outcome: t(`activity.outcome_${record.outcome}`),
    operation: t(`activity.operation_${record.operation}`),
    failure: t(`activity.${compact ? 'failedShort' : 'failed'}_${record.operation}`),
    when: relativeTime(record.at, now, locale, compact ? 'short' : 'long').replaceAll(' ', ' '),
  };
}
