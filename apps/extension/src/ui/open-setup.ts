import { canonicalizeWebsiteOrigin } from '../security/canonicalize.js';

/** A setup step the popup's checklist can open the setup page on. */
export type SetupStep = 'website' | 'tracker';

/**
 * What the setup page should put in front of the user when it opens: a website to approve, a
 * suggestion to review, the form of a checklist step, or the restore control of an approval that
 * lost access (`MissingAccess['focus']`).
 */
export type SetupFocus =
  | { website: string }
  | { suggestion: string }
  | { step: SetupStep }
  | { restore: string };

const SETUP_PAGE = 'src/options/index.html';

/**
 * Opens the setup page in a new tab with a pre-filled website, a highlighted suggestion, a step's
 * form or a restore control in focus. Used by the popup, which must not request host permissions
 * itself (design D1): the user confirms on the setup page, and that click runs the prompt.
 */
export async function openSetupPage(focus: SetupFocus): Promise<void> {
  const query = new URLSearchParams(focus);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`${SETUP_PAGE}?${query}`) });
}

/**
 * The current tab's origin when the popup should offer to approve it: a valid website origin
 * (HTTPS, or HTTP on loopback) that is not approved yet. Browser pages and files never qualify.
 */
export function currentWebsiteOffer(
  tabUrl: string | undefined,
  approvedOrigins: readonly string[],
): string | null {
  if (!tabUrl) return null;
  try {
    const { origin } = canonicalizeWebsiteOrigin(new URL(tabUrl).origin);
    return approvedOrigins.includes(origin) ? null : origin;
  } catch {
    return null;
  }
}

const STEPS: readonly SetupStep[] = ['website', 'tracker'];

function isSetupStep(value: string | null): value is SetupStep {
  return STEPS.some((step) => step === value);
}

/** Reads the focus the popup asked for from the setup page's own URL. */
export function readSetupFocus(search: string) {
  const query = new URLSearchParams(search);
  const step = query.get('step');
  return {
    website: query.get('website') ?? undefined,
    suggestion: query.get('suggestion') ?? undefined,
    step: isSetupStep(step) ? step : undefined,
    restore: query.get('restore') ?? undefined,
  };
}
