/** What the setup page should put in front of the user when it opens. */
export type SetupFocus = { website: string } | { suggestion: string };

const SETUP_PAGE = 'src/options/index.html';

/**
 * Opens the setup page in a new tab with a pre-filled website or a highlighted suggestion. Used
 * by the popup, which must not request host permissions itself (design D1): the user confirms on
 * the setup page, and that click runs the permission prompt.
 */
export async function openSetupPage(focus: SetupFocus): Promise<void> {
  const query = new URLSearchParams(focus);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`${SETUP_PAGE}?${query}`) });
}

/** Reads the focus the popup asked for from the setup page's own URL. */
export function readSetupFocus(search: string) {
  const query = new URLSearchParams(search);
  return {
    website: query.get('website') ?? undefined,
    suggestion: query.get('suggestion') ?? undefined,
  };
}
