import { describe, expect, it } from 'vite-plus/test';
import { openWebsite, type BrowserTab, type TabNavigator } from '../../src/ui/open-website.js';

function fakeNavigator(tabs: BrowserTab[]) {
  const queries: string[] = [];
  const activated: number[] = [];
  const created: string[] = [];
  const calls = { queries, activated, created };
  const navigator: TabNavigator = {
    query: async ({ url }) => {
      calls.queries.push(url);
      return tabs;
    },
    activate: async (tab) => {
      calls.activated.push(tab.id);
    },
    create: async (url) => {
      calls.created.push(url);
    },
  };
  return { navigator, calls };
}

describe('openWebsite', () => {
  it('focuses an open tab on the same origin instead of opening another', async () => {
    const { navigator, calls } = fakeNavigator([
      { id: 4, windowId: 1, url: 'https://time.example.com/timer' },
    ]);
    await openWebsite('https://time.example.com', navigator);
    expect(calls.queries).toEqual(['https://time.example.com/*']);
    expect(calls.activated).toEqual([4]);
    expect(calls.created).toEqual([]);
  });

  it('opens a new tab when only a different port of the host is open', async () => {
    const { navigator, calls } = fakeNavigator([
      { id: 4, windowId: 1, url: 'http://localhost:3001/timer' },
    ]);
    await openWebsite('http://localhost:3000', navigator);
    expect(calls.activated).toEqual([]);
    expect(calls.created).toEqual(['http://localhost:3000']);
  });

  it('opens a new tab when no tab is visible for the origin', async () => {
    const { navigator, calls } = fakeNavigator([{ id: 4, windowId: 1 }]);
    await openWebsite('https://time.example.com', navigator);
    expect(calls.created).toEqual(['https://time.example.com']);
  });
});
