import type { ApprovalService } from '../approvals/approvals.js';
import { detectLocale, translate, type ExtensionLocale } from '../i18n/translate.js';
import type { SuggestionService } from '../suggestions/suggestions.js';

/**
 * Pages keep the language in `localStorage`, which the service worker cannot read, so the choice
 * is mirrored here for the toolbar title.
 */
export const LOCALE_MIRROR_KEY = 'osi.locale';

/** Amber, the extension pages' warning shade. */
const ATTENTION_COLOR = '#d97706';

export interface BadgeState {
  text: string;
  title: string;
}

/**
 * Pending suggestions win over missing site access: they are something to do, not just a state.
 * The title says the same as the badge, so the state never depends on its color.
 */
export function badgeState(
  pendingSuggestions: number,
  missingAccess: boolean,
  locale: ExtensionLocale,
): BadgeState {
  if (pendingSuggestions > 0) {
    return {
      text: String(pendingSuggestions),
      title: translate(locale, 'app.badgeSuggestions', { count: pendingSuggestions }),
    };
  }
  if (missingAccess) return { text: '!', title: translate(locale, 'app.badgeAttention') };
  return { text: '', title: translate(locale, 'app.name') };
}

export interface ToolbarAction {
  setBadgeText(details: { text: string }): Promise<void>;
  setBadgeBackgroundColor(details: { color: string }): Promise<void>;
  setTitle(details: { title: string }): Promise<void>;
}

export async function readMirroredLocale(
  storage: ChromeStorageArea = chrome.storage.local,
): Promise<ExtensionLocale> {
  const stored = (await storage.get(LOCALE_MIRROR_KEY))[LOCALE_MIRROR_KEY];
  return stored === 'en' || stored === 'pl' ? stored : detectLocale();
}

/** Recomputes the toolbar badge and title from pending suggestions and site access. */
export async function refreshBadge(deps: {
  approvals: ApprovalService;
  suggestions: SuggestionService;
  action: ToolbarAction;
  locale: () => Promise<ExtensionLocale>;
}): Promise<void> {
  const [state, pending, locale] = await Promise.all([
    deps.approvals.list(),
    deps.suggestions.list(),
    deps.locale(),
  ]);
  const origins = new Set([
    ...state.websites.map((item) => item.origin),
    ...state.destinations.map((item) => item.origin),
  ]);
  const access = await Promise.all(
    [...origins].map((origin) => deps.approvals.hasHostPermission(origin)),
  );
  const badge = badgeState(pending.length, access.includes(false), locale);
  await Promise.all([
    deps.action.setBadgeText({ text: badge.text }),
    deps.action.setBadgeBackgroundColor({ color: ATTENTION_COLOR }),
    deps.action.setTitle({ title: badge.title }),
  ]);
}
