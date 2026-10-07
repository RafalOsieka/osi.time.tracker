import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import type { JsonObject } from '@osi/remote-trackers/contracts';
import type { CookieJar } from '../helpers/auth';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedAndLogin } from '../helpers/session';
import { setupServer } from '../harness/setup-server';

const describeProfile = requireDocker();

/** PATCHes the profile with the session's cookies and CSRF token. */
function patchProfile(jar: CookieJar, csrfToken: string, body: JsonObject) {
  return fetch(url('/api/user/profile'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'csrf-token': csrfToken, cookie: jar.header() },
    body: JSON.stringify(body),
  });
}

describeProfile('user profile API integration', async () => {
  const databaseUrl = await provisionDatabase();
  await setupServer({ databaseUrl });

  it('reads the profile and refreshes the sealed session on each PATCH', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl, { displayName: 'Jan', timezone: 'UTC' });

    const initial = await fetch(url('/api/user/profile'), { headers: { cookie: jar.header() } });
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ displayName: 'Jan', timezone: 'UTC' });

    const name = await patchProfile(jar, token, { displayName: '  Jan Kowalski  ' });
    expect(name.status).toBe(200);
    expect(await name.json()).toEqual({ displayName: 'Jan Kowalski', timezone: 'UTC' });
    jar.capture(name);

    const zone = await patchProfile(jar, token, { timezone: 'Europe/Warsaw', weekStart: 'sunday' });
    expect(zone.status).toBe(200);
    expect(await zone.json()).toEqual({ displayName: 'Jan Kowalski', timezone: 'Europe/Warsaw' });
    jar.capture(zone);

    const session = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect((await session.json()).user).toMatchObject({
      displayName: 'Jan Kowalski',
      timezone: 'Europe/Warsaw',
    });

    const utc = await patchProfile(jar, token, { timezone: 'UTC' });
    expect(utc.status).toBe(200);
  });

  it.each<{ body: JsonObject; messageKey: string }>([
    { body: { displayName: '   ' }, messageKey: 'errors.profile.displayNameRequired' },
    { body: { displayName: 'x'.repeat(101) }, messageKey: 'errors.profile.displayNameTooLong' },
    { body: { timezone: 'Not/A_Timezone' }, messageKey: 'errors.profile.invalidTimezone' },
    { body: { displayName: null }, messageKey: 'errors.profile.displayNameRequired' },
    { body: { timezone: null }, messageKey: 'errors.profile.invalidTimezone' },
  ])('rejects $body with 422 and persists nothing', async ({ body, messageKey }) => {
    const { jar, token } = await seedAndLogin(databaseUrl, {
      displayName: 'Kept',
      timezone: 'UTC',
    });

    const res = await patchProfile(jar, token, body);
    expect(res.status).toBe(422);
    expect((await res.json()).data.messageKey).toBe(messageKey);

    const after = await fetch(url('/api/user/profile'), { headers: { cookie: jar.header() } });
    expect(await after.json()).toEqual({ displayName: 'Kept', timezone: 'UTC' });
  });

  it('includes max for a too-long display name', async () => {
    const { jar, token } = await seedAndLogin(databaseUrl);
    const res = await patchProfile(jar, token, { displayName: 'x'.repeat(101) });
    expect((await res.json()).data.params).toEqual({ max: 100 });
  });

  it('rejects unauthenticated and CSRF-less requests', async () => {
    expect((await fetch(url('/api/user/profile'))).status).toBe(401);

    const { jar } = await seedAndLogin(databaseUrl, { displayName: 'Kept' });
    const noCsrf = await fetch(url('/api/user/profile'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: jar.header() },
      body: JSON.stringify({ displayName: 'Changed' }),
    });
    expect(noCsrf.status).toBe(403);
    const after = await fetch(url('/api/user/profile'), { headers: { cookie: jar.header() } });
    expect((await after.json()).displayName).toBe('Kept');
  });
});
