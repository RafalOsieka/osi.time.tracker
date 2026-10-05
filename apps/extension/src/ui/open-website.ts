import { hostMatchPattern } from '../approvals/approvals.js';

export interface BrowserTab {
  id?: number;
  windowId: number;
  url?: string;
}

/** The slice of `chrome.tabs`/`chrome.windows` needed to switch to or open a website tab. */
export interface TabNavigator {
  query(queryInfo: { url: string }): Promise<BrowserTab[]>;
  activate(tab: BrowserTab & { id: number }): Promise<void>;
  create(url: string): Promise<void>;
}

export function chromeTabNavigator(): TabNavigator {
  return {
    query: (queryInfo) => chrome.tabs.query(queryInfo),
    // Both at once: focusing the window can close the popup before a second call would run.
    activate: async (tab) => {
      await Promise.all([
        chrome.tabs.update(tab.id, { active: true }),
        chrome.windows.update(tab.windowId, { focused: true }),
      ]);
    },
    create: async (url) => {
      await chrome.tabs.create({ url });
    },
  };
}

/**
 * Focuses an open tab on exactly this origin (scheme, host and port), or opens the origin in a new
 * tab. Tabs are only visible for origins the extension has host access to, so a website without
 * access always gets a new tab.
 */
export async function openWebsite(
  origin: string,
  navigator: TabNavigator = chromeTabNavigator(),
): Promise<void> {
  const tabs = await navigator.query({ url: hostMatchPattern(origin) });
  const existing = tabs.find(
    (tab): tab is BrowserTab & { id: number } =>
      tab.id !== undefined && tab.url !== undefined && new URL(tab.url).origin === origin,
  );
  if (existing) await navigator.activate(existing);
  else await navigator.create(origin);
}
