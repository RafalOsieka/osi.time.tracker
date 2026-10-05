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

/** One-line summary of a destination's latest operation, or the "no activity" text. */
export function formatActivity(
  record: ActivityRecord | undefined,
  now: number,
  locale: ExtensionLocale,
  t: Translate,
): string {
  if (!record) return t('activity.none');
  return [
    relativeTime(record.at, now, locale),
    t(`activity.operation_${record.operation}`),
    t(`activity.outcome_${record.outcome}`),
  ].join(' · ');
}
