import { url } from './url';
import type { CookieJar } from './auth';
import type { CreateTrackerDto } from '../../../shared/types/tracker';
import type { JsonObject } from '../../../shared/types/json';

function trackerSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'tracker'
  );
}

export async function createTracker(
  jar: CookieJar,
  token: string,
  name: string,
  overrides: Partial<CreateTrackerDto> = {},
): Promise<{ id: string; name: string }> {
  const res = await fetch(url('/api/trackers'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify({
      name,
      systemType: 'openproject',
      baseUrl: `https://${trackerSlug(name)}.example.com`,
      executionMode: 'client',
      roundingRule: 'none',
      ...overrides,
    }),
  });
  return res.json();
}

export async function createProject(
  jar: CookieJar,
  token: string,
  name: string,
  trackerId?: string | null,
): Promise<{ id: string; name: string; trackerId: string | null }> {
  const res = await fetch(url('/api/projects'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(trackerId === undefined ? { name } : { name, trackerId }),
  });
  return res.json();
}

export async function startEntry(
  jar: CookieJar,
  token: string,
  body: JsonObject = {},
): Promise<Response> {
  return fetch(url('/api/time-entries'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

export async function patchEntry(
  jar: CookieJar,
  token: string,
  id: string,
  body: JsonObject,
): Promise<Response> {
  return fetch(url(`/api/time-entries/${id}`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}
