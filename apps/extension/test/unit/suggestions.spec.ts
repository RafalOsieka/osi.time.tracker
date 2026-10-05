import { describe, expect, it } from 'vite-plus/test';
import { ExtensionProtocolError } from '@osi/extension-protocol';
import {
  ApprovalService,
  createMemoryApprovalStore,
  createMemoryHostPermissions,
} from '../../src/approvals/approvals.js';
import { CanonicalizationError } from '../../src/security/canonicalize.js';
import {
  MAX_PENDING_SUGGESTIONS,
  SuggestionService,
  createMemorySuggestionStore,
  suggestionId,
} from '../../src/suggestions/suggestions.js';

const website = 'https://time.example.com';
const tracker = 'https://rm.example.com/team';

async function setup(permissions = createMemoryHostPermissions()) {
  const approvals = new ApprovalService(createMemoryApprovalStore(), permissions);
  await approvals.approveWebsite(website);
  const suggestions = new SuggestionService(createMemorySuggestionStore(), approvals);
  return { approvals, suggestions };
}

describe('tracker suggestions', () => {
  it('queues a suggestion once, however often it is repeated', async () => {
    const { suggestions } = await setup();
    expect(await suggestions.suggest(website, 'redmine', tracker)).toBe('queued');
    expect(await suggestions.suggest(website, 'redmine', `${tracker}/`)).toBe('queued');
    expect(await suggestions.list()).toMatchObject([
      { websiteOrigin: website, provider: 'redmine', origin: 'https://rm.example.com' },
    ]);
  });

  it('does not queue a destination the website already has approved', async () => {
    const { approvals, suggestions } = await setup();
    await approvals.approveDestination(website, 'redmine', tracker);
    expect(await suggestions.suggest(website, 'redmine', tracker)).toBe('alreadyApproved');
    expect(await suggestions.list()).toEqual([]);
  });

  it('rejects further suggestions when the list is full and keeps the existing ones', async () => {
    const { suggestions } = await setup();
    for (let index = 0; index < MAX_PENDING_SUGGESTIONS; index++) {
      await suggestions.suggest(website, 'redmine', `https://rm${index}.example.com`);
    }
    const before = await suggestions.list();
    await expect(
      suggestions.suggest(website, 'redmine', 'https://one-too-many.example.com'),
    ).rejects.toMatchObject({ kind: 'limit' });
    await expect(
      suggestions.suggest(website, 'redmine', 'https://one-too-many.example.com'),
    ).rejects.toBeInstanceOf(ExtensionProtocolError);
    expect(await suggestions.list()).toEqual(before);
  });

  it.each([
    ['an unapproved website', 'https://other.example.com', tracker],
    ['credentials in the URL', website, 'https://user:pw@rm.example.com'],
    ['a query string', website, 'https://rm.example.com/?x=1'],
  ])('rejects %s', async (_name, origin, baseUrl) => {
    const { suggestions } = await setup();
    await expect(suggestions.suggest(origin, 'redmine', baseUrl)).rejects.toBeInstanceOf(
      CanonicalizationError,
    );
    expect(await suggestions.list()).toEqual([]);
  });

  it('approves a suggestion as a destination and removes it from the list', async () => {
    const { approvals, suggestions } = await setup();
    await suggestions.suggest(website, 'redmine', tracker);
    const [pending] = await suggestions.list();
    await suggestions.approve(suggestionId(pending!));
    expect((await approvals.list()).destinations).toMatchObject([
      { websiteOrigin: website, provider: 'redmine', basePath: '/team' },
    ]);
    expect(await suggestions.list()).toEqual([]);
  });

  it('keeps the suggestion when the browser permission is denied', async () => {
    const permissions = createMemoryHostPermissions();
    const { suggestions } = await setup(permissions);
    await suggestions.suggest(website, 'redmine', tracker);
    permissions.request = async () => false;
    const [pending] = await suggestions.list();
    await expect(suggestions.approve(suggestionId(pending!))).rejects.toBeInstanceOf(
      CanonicalizationError,
    );
    expect(await suggestions.list()).toHaveLength(1);
  });

  it('dismisses a suggestion without approving it', async () => {
    const { approvals, suggestions } = await setup();
    await suggestions.suggest(website, 'redmine', tracker);
    const [pending] = await suggestions.list();
    await suggestions.dismiss(suggestionId(pending!));
    expect(await suggestions.list()).toEqual([]);
    expect((await approvals.list()).destinations).toEqual([]);
  });

  it('prunes suggestions of revoked websites', async () => {
    const { approvals, suggestions } = await setup();
    await suggestions.suggest(website, 'redmine', tracker);
    await approvals.revokeWebsite(website);
    await suggestions.prune();
    expect(await suggestions.list()).toEqual([]);
  });
});
