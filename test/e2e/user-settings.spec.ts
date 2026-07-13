import { expect, it } from 'vitest';
import { url } from '@nuxt/test-utils/e2e';
import { CookieJar, primeCsrf } from './support/auth';
import { requireDocker } from './support/guards';
import { provisionDatabase } from './support/database';
import { seedUsers } from './support/seed';
import { setupServer } from './support/setupServer';

const describeSettings = requireDocker();

describeSettings('user settings API integration', async () => {
  const databaseUrl = await provisionDatabase();
  await seedUsers(databaseUrl, [{ email: 'settings@example.com', displayName: 'Settings' }]);
  await setupServer({ databaseUrl });

  it('persists settings and refreshes the sealed session', async () => {
    const jar = new CookieJar();
    const csrfToken = await primeCsrf(jar);
    const login = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify({ email: 'settings@example.com', password: 'secret' }),
    });
    expect(login.status).toBe(200);
    jar.capture(login);

    const initial = await fetch(url('/api/user/settings'), { headers: { cookie: jar.header() } });
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ timezone: null, weekStart: 'monday' });

    const patch = await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify({ timezone: 'America/New_York', weekStart: 'sunday' }),
    });
    expect(patch.status).toBe(200);
    expect(await patch.json()).toEqual({ timezone: 'America/New_York', weekStart: 'sunday' });
    jar.capture(patch);

    const session = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect((await session.json()).user.settings).toEqual({
      timezone: 'America/New_York',
      weekStart: 'sunday',
    });

    const invalid = await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify({ timezone: 'Not/A_Timezone' }),
    });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).data.messageKey).toBe('errors.userSettings.invalidTimezone');

    const unauthenticated = await fetch(url('/api/user/settings'));
    expect(unauthenticated.status).toBe(401);
  });
});
