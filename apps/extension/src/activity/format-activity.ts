import type { ExtensionLocale, MessageParams } from '../i18n/translate.js';
import type { ActivityRecord } from './activity-store.js';

type Translate = (key: string, params?: MessageParams) => string;

/** "now", "3 minutes ago", "yesterday"… in the extension's language. */
export function relativeTime(at: string, now: number, locale: ExtensionLocale): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
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

export function summarizeActivity(
  record: ActivityRecord,
  now: number,
  locale: ExtensionLocale,
  t: Translate,
): ActivitySummary {
  return {
    ok: record.outcome === 'ok',
    outcome: t(`activity.outcome_${record.outcome}`),
    operation: t(`activity.operation_${record.operation}`),
    failure: t(`activity.failed_${record.operation}`),
    when: relativeTime(record.at, now, locale).replaceAll(' ', '\u00a0'),
  };
}
