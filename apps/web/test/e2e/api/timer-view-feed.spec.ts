import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import type { CookieJar } from '../helpers/auth';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedAndLogin } from '../helpers/session';
import { setupServer } from '../harness/setup-server';

const describeFeed = requireDocker();

type FeedEntry = { id: string; taskName: string | null; startedAt: string };
type FeedPage = { entries: FeedEntry[]; hasMore: boolean; nextBefore: string | null };

describeFeed('timer view feed API', async () => {
  const databaseUrl = await provisionDatabase();
  await setupServer({ databaseUrl });

  async function createEntry(
    jar: CookieJar,
    csrfToken: string,
    body: { title?: string; startedAt: string; stoppedAt: string },
  ) {
    const res = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    const created: FeedEntry = await res.json();
    return created;
  }

  async function getFeed(jar: CookieJar, query: { before?: string; from?: string } = {}) {
    const res = await requestFeed(jar, query);
    expect(res.status).toBe(200);
    const page: FeedPage = await res.json();
    return page;
  }

  function requestFeed(jar: CookieJar, query: { before?: string; from?: string }) {
    const params = new URLSearchParams(query).toString();
    const path = params ? `/api/time-entries/feed?${params}` : '/api/time-entries/feed';
    return fetch(url(path), { headers: { cookie: jar.header() } });
  }

  const DAY_MS = 24 * 60 * 60 * 1000;

  /** Stopped entry spanning 30 minutes starting `daysAgo` calendar days before `now`. */
  function entryWindow(daysAgo: number, nowMs = Date.now()) {
    const startedAt = new Date(nowMs - daysAgo * DAY_MS);
    const stoppedAt = new Date(startedAt.getTime() + 30 * 60 * 1000);
    return { startedAt: startedAt.toISOString(), stoppedAt: stoppedAt.toISOString() };
  }

  /** UTC day start (the seeded user has no stored timezone) of an ISO instant. */
  function utcDayStart(iso: string) {
    return `${iso.slice(0, 10)}T00:00:00Z`;
  }

  /** One entry per listed day offset, titled `${prefix} ${daysAgo}`. */
  async function seedDays(jar: CookieJar, csrfToken: string, prefix: string, offsets: number[]) {
    const now = Date.now();
    const created: FeedEntry[] = [];
    for (const daysAgo of offsets) {
      created.push(
        await createEntry(jar, csrfToken, {
          title: `${prefix} ${daysAgo}`,
          ...entryWindow(daysAgo, now),
        }),
      );
    }
    return created;
  }

  it('returns empty never-tracked feed', async () => {
    const { jar } = await seedAndLogin(databaseUrl);
    expect(await getFeed(jar)).toEqual({ entries: [], hasMore: false, nextBefore: null });
  });

  it('rejects unauthenticated and malformed cursor requests', async () => {
    const { jar } = await seedAndLogin(databaseUrl);
    expect((await fetch(url('/api/time-entries/feed'))).status).toBe(401);
    expect((await requestFeed(jar, { before: 'not-an-instant' })).status).toBe(422);
  });

  it('initial page returns the newest seven activity days', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    const created = await seedDays(jar, token, 'Day', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const first = await getFeed(jar);
    expect(first.entries.map((e) => e.taskName)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 4',
      'Day 5',
      'Day 6',
      'Day 7',
    ]);
    expect(first.hasMore).toBe(true);
    expect(first.nextBefore).toBe(utcDayStart(created[6]!.startedAt));

    const second = await getFeed(jar, { before: first.nextBefore! });
    expect(second.entries.map((e) => e.taskName)).toEqual(['Day 8', 'Day 9', 'Day 10']);
    expect(second.hasMore).toBe(false);
    expect(second.nextBefore).toBeNull();
  });

  it('initial page skips calendar gaps when history is old', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    await seedDays(jar, token, 'Old', [60, 70, 80]);

    const feed = await getFeed(jar);
    expect(feed.entries.map((e) => e.taskName)).toEqual(['Old 60', 'Old 70', 'Old 80']);
    expect(feed.hasMore).toBe(false);
    expect(feed.nextBefore).toBeNull();
  });

  it('load more returns up to seven activity days and skips empty calendar gaps', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    // Sixteen activity days, ~10 calendar days apart: gaps must not consume slots.
    const offsets = Array.from({ length: 16 }, (_, index) => 10 + index * 10);
    await seedDays(jar, token, 'Gap', offsets);

    const initial = await getFeed(jar);
    expect(initial.entries).toHaveLength(7);
    const firstMore = await getFeed(jar, { before: initial.nextBefore! });
    expect(firstMore.entries.map((e) => e.taskName)).toEqual(
      offsets.slice(7, 14).map((daysAgo) => `Gap ${daysAgo}`),
    );
    expect(firstMore.hasMore).toBe(true);

    const secondMore = await getFeed(jar, { before: firstMore.nextBefore! });
    expect(secondMore.entries.map((e) => e.taskName)).toEqual(['Gap 150', 'Gap 160']);
    expect(secondMore.hasMore).toBe(false);
    expect(secondMore.nextBefore).toBeNull();

    // A cursor past all history yields an empty page.
    const pastAll = await getFeed(jar, {
      before: new Date(Date.now() - 400 * DAY_MS).toISOString(),
    });
    expect(pastAll).toEqual({ entries: [], hasMore: false, nextBefore: null });
  });

  it('range refresh returns the whole loaded window in one response', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    const offsets = Array.from({ length: 12 }, (_, index) => index + 1);
    const created = await seedDays(jar, token, 'Range', offsets);

    // Window loaded down to the 10th activity day.
    const from = utcDayStart(created[9]!.startedAt);
    const refreshed = await getFeed(jar, { from });
    expect(refreshed.entries.map((e) => e.taskName)).toEqual(
      offsets.slice(0, 10).map((daysAgo) => `Range ${daysAgo}`),
    );
    expect(refreshed.hasMore).toBe(true);
    expect(refreshed.nextBefore).toBe(from);
  });

  it('range refresh with nothing in range still reports older history', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    await seedDays(jar, token, 'Before', [5]);

    const from = utcDayStart(new Date(Date.now() - 2 * DAY_MS).toISOString());
    const refreshed = await getFeed(jar, { from });
    expect(refreshed).toEqual({ entries: [], hasMore: true, nextBefore: from });
  });

  it('rejects before and from together, and a malformed from', async () => {
    const { jar } = await seedAndLogin(databaseUrl);
    const instant = new Date().toISOString();

    const both = await requestFeed(jar, { before: instant, from: instant });
    expect(both.status).toBe(422);
    expect((await both.json()).data).toMatchObject({
      messageKey: 'error.timeEntryFeedCursorConflict',
    });

    const malformed = await requestFeed(jar, { from: '2024-06-01' });
    expect(malformed.status).toBe(422);
    expect((await malformed.json()).data).toMatchObject({
      messageKey: 'error.timeEntryRangeInvalid',
    });
  });

  it("never includes another user's entries", async () => {
    const owner = await seedAndLogin(databaseUrl);
    const other = await seedAndLogin(databaseUrl);
    const now = Date.now();

    await createEntry(owner.jar, owner.token, {
      title: 'Owner Entry',
      ...entryWindow(1, now),
    });
    await createEntry(other.jar, other.token, {
      title: 'Other User Entry',
      ...entryWindow(1, now),
    });

    const ownerFeed = await getFeed(owner.jar);
    expect(ownerFeed.entries.some((e) => e.taskName === 'Owner Entry')).toBe(true);
    expect(ownerFeed.entries.some((e) => e.taskName === 'Other User Entry')).toBe(false);

    const otherFeed = await getFeed(other.jar);
    expect(otherFeed.entries.some((e) => e.taskName === 'Other User Entry')).toBe(true);
    expect(otherFeed.entries.some((e) => e.taskName === 'Owner Entry')).toBe(false);
  });
});
