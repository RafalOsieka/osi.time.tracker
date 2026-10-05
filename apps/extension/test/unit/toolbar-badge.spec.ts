import { describe, expect, it } from 'vite-plus/test';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
  hostMatchPattern,
} from '../../src/approvals/approvals.js';
import { badgeState, refreshBadge, type ToolbarAction } from '../../src/badge/toolbar-badge.js';
import {
  SuggestionService,
  createMemorySuggestionStore,
} from '../../src/suggestions/suggestions.js';

describe('toolbar badge', () => {
  it('counts pending suggestions before anything else', () => {
    expect(badgeState(2, true, 'en')).toEqual({
      text: '2',
      title: 'OSI Time Tracker: trackers waiting for approval: 2',
    });
  });

  it('marks missing site access when nothing is pending', () => {
    expect(badgeState(0, true, 'pl')).toEqual({
      text: '!',
      title: 'OSI Time Tracker: konfiguracja wymaga uwagi',
    });
  });

  it('clears the badge when everything is in order', () => {
    expect(badgeState(0, false, 'en')).toEqual({ text: '', title: 'OSI Time Tracker' });
  });

  it('reads suggestions and site access from the extension state', async () => {
    const permissions = createMemoryHostPermissions();
    const approvals = new ApprovalService(createMemoryApprovalStore(), permissions);
    await approvals.approveWebsite('http://localhost:3000');
    const suggestions = new SuggestionService(createMemorySuggestionStore(), approvals);
    const shown = { text: '', title: '' };
    const action: ToolbarAction = {
      setBadgeText: async ({ text }) => {
        shown.text = text;
      },
      setBadgeBackgroundColor: async () => {},
      setTitle: async ({ title }) => {
        shown.title = title;
      },
    };
    const refresh = () =>
      refreshBadge({ approvals, suggestions, action, locale: async () => 'en' });

    await refresh();
    expect(shown.text).toBe('');
    await permissions.remove(hostMatchPattern('http://localhost:3000'));
    await refresh();
    expect(shown.text).toBe('!');
    await suggestions.suggest('http://localhost:3000', 'redmine', 'https://rm.example.com');
    await refresh();
    expect(shown.text).toBe('1');
  });
});
