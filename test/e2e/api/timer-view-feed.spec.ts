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

  async function getFeed(jar: CookieJar, before?: string): Promise<FeedPage> {
    const path = before
      ? `/api/time-entries/feed?before=${encodeURIComponent(before)}`
      : '/api/time-entries/feed';
    const res = await fetch(url(path), { headers: { cookie: jar.header() } });
    expect(res.status).toBe(200);
    const page: FeedPage = await res.json();
    return page;
  }

  /** Stopped entry spanning 30 minutes starting `daysAgo` calendar days before `now`. */
  function entryWindow(daysAgo: number, nowMs = Date.now()) {
    const startedAt = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000);
    const stoppedAt = new Date(startedAt.getTime() + 30 * 60 * 1000);
    return { startedAt: startedAt.toISOString(), stoppedAt: stoppedAt.toISOString() };
  }

  it('returns empty never-tracked feed', async () => {
    const { jar } = await seedAndLogin(databaseUrl);
    const res = await fetch(url('/api/time-entries/feed'), { headers: { cookie: jar.header() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [], hasMore: false, nextBefore: null });
  });

  it('returns last-30-day entries and pages older activity days', async () => {
    const { jar, token: csrfToken } = await seedAndLogin(databaseUrl);
    const now = Date.now();
    await createEntry(jar, csrfToken, {
      title: 'Recent',
      startedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      stoppedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    });
    await createEntry(jar, csrfToken, {
      title: 'Old A',
      ...entryWindow(40, now),
    });
    await createEntry(jar, csrfToken, {
      title: 'Old B',
      ...entryWindow(50, now),
    });

    const first = await getFeed(jar);
    expect(first.entries.some((e) => e.taskName === 'Recent')).toBe(true);
    expect(first.entries.some((e) => e.taskName === 'Old A')).toBe(false);
    expect(first.hasMore).toBe(true);
    expect(first.nextBefore).toBeTruthy();

    const second = await getFeed(jar, first.nextBefore!);
    expect(second.entries.length).toBeGreaterThan(0);
    expect(second.entries.some((e) => e.taskName === 'Old A' || e.taskName === 'Old B')).toBe(true);

    const unauth = await fetch(url('/api/time-entries/feed'));
    expect(unauth.status).toBe(401);

    const bad = await fetch(url('/api/time-entries/feed?before=not-an-instant'), {
      headers: { cookie: jar.header() },
    });
    expect(bad.status).toBe(422);
  });

  it('falls back to the newest activity day when the last 30 days are empty', async () => {
    const { jar, token: csrfToken } = await seedAndLogin(databaseUrl);
    const now = Date.now();
    await createEntry(jar, csrfToken, {
      title: 'Only Old Day',
      ...entryWindow(45, now),
    });

    const feed = await getFeed(jar);
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0]?.taskName).toBe('Only Old Day');
    expect(feed.hasMore).toBe(false);
    expect(feed.nextBefore).toBeNull();
  });

  it('sets hasMore false after paging through all older activity days', async () => {
    const { jar, token: csrfToken } = await seedAndLogin(databaseUrl);
    const now = Date.now();
    await createEntry(jar, csrfToken, {
      title: 'Exhaust Recent',
      ...entryWindow(1, now),
    });
    await createEntry(jar, csrfToken, {
      title: 'Exhaust Old',
      ...entryWindow(40, now),
    });

    let page = await getFeed(jar);
    expect(page.entries.some((e) => e.taskName === 'Exhaust Recent')).toBe(true);
    expect(page.hasMore).toBe(true);

    const titles = new Set(page.entries.map((e) => e.taskName));
    let guard = 0;
    while (page.hasMore && page.nextBefore && guard < 10) {
      page = await getFeed(jar, page.nextBefore);
      for (const entry of page.entries) titles.add(entry.taskName);
      guard += 1;
    }

    expect(page.hasMore).toBe(false);
    expect(page.nextBefore).toBeNull();
    expect(titles.has('Exhaust Recent')).toBe(true);
    expect(titles.has('Exhaust Old')).toBe(true);

    // A further page with the last cursor (or a bound past all history) is empty.
    const pastAll = await getFeed(jar, new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString());
    expect(pastAll.entries).toEqual([]);
    expect(pastAll.hasMore).toBe(false);
  });

  it('load more returns up to seven activity days and skips empty calendar gaps', async () => {
    const { jar, token: csrfToken } = await seedAndLogin(databaseUrl);
    const now = Date.now();
    // One recent day inside the 30-day window.
    await createEntry(jar, csrfToken, {
      title: 'Gap Recent',
      ...entryWindow(2, now),
    });
    // Nine older activity days, each ~10 calendar days apart (gaps must not consume slots).
    const olderDayOffsets = [40, 50, 60, 70, 80, 90, 100, 110, 120];
    for (const [index, daysAgo] of olderDayOffsets.entries()) {
      await createEntry(jar, csrfToken, {
        title: `Gap Old ${index + 1}`,
        ...entryWindow(daysAgo, now),
      });
    }

    const initial = await getFeed(jar);
    expect(initial.entries.some((e) => e.taskName === 'Gap Recent')).toBe(true);
    expect(initial.entries.every((e) => e.taskName === 'Gap Recent')).toBe(true);
    expect(initial.hasMore).toBe(true);

    const firstMore = await getFeed(jar, initial.nextBefore!);
    const firstMoreTitles = firstMore.entries.map((e) => e.taskName).filter(Boolean);
    // Newest-first among older days: Gap Old 1 … Gap Old 7 (days 40–100).
    expect(firstMoreTitles).toHaveLength(7);
    expect(firstMoreTitles).toEqual([
      'Gap Old 1',
      'Gap Old 2',
      'Gap Old 3',
      'Gap Old 4',
      'Gap Old 5',
      'Gap Old 6',
      'Gap Old 7',
    ]);
    expect(firstMore.hasMore).toBe(true);
    expect(firstMore.nextBefore).toBeTruthy();

    const secondMore = await getFeed(jar, firstMore.nextBefore!);
    const secondTitles = secondMore.entries.map((e) => e.taskName).filter(Boolean);
    expect(secondTitles).toEqual(['Gap Old 8', 'Gap Old 9']);
    expect(secondMore.hasMore).toBe(false);
    expect(secondMore.nextBefore).toBeNull();
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
