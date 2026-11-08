import type { MessageParams } from '../i18n/translate.js';
import type { MissingAccess } from './extension-status.js';

type Translate = (key: string, params?: MessageParams) => string;

/** The short title above each error's explanation; anything unlisted is a change that failed. */
const ERROR_TITLES = new Map([
  ['approvals.loadFailed', 'approvals.loadFailedTitle'],
  ['approvals.denied', 'approvals.deniedTitle'],
  ['approvals.setupFailed', 'approvals.setupFailedTitle'],
  ['approvals.websiteRequired', 'approvals.websiteRequiredTitle'],
]);

export function errorTitleKey(errorKey: string): string {
  return ERROR_TITLES.get(errorKey) ?? 'approvals.changeFailedTitle';
}

/**
 * The missing-access alert: it names what lost access and where to restore it. The popup sends
 * the user to the setup page; the setup page restores one approval from the alert itself.
 */
export function missingAccessAlert(
  items: readonly MissingAccess[],
  surface: 'popup' | 'setup',
  t: Translate,
): { title: string; description: string } | null {
  const [only, ...others] = items;
  if (!only) return null;
  if (others.length > 0) {
    return {
      title: t('approvals.lostAccessManyTitle'),
      description: t(`approvals.lostAccessMany_${surface}`, {
        names: items.map((item) => item.name).join(', '),
      }),
    };
  }
  return {
    title: t('approvals.lostAccessTitle', { name: only.name }),
    description: t(`approvals.lost_${only.kind}_${surface}`),
  };
}
