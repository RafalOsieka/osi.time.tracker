import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { seedAndLogin } from '../helpers/session';
import { setupServer } from '../harness/setup-server';

const describeSettings = requireDocker();

describeSettings('user settings API integration', async () => {
  const databaseUrl = await provisionDatabase();
  await setupServer({ databaseUrl });

  it('persists settings and refreshes the sealed session', async () => {
    const { jar, token: csrfToken } = await seedAndLogin(databaseUrl);

    const initial = await fetch(url('/api/user/settings'), { headers: { cookie: jar.header() } });
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ timezone: null });

    const patch = await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify({ timezone: 'America/New_York' }),
    });
    expect(patch.status).toBe(200);
    expect(await patch.json()).toEqual({ timezone: 'America/New_York' });
    jar.capture(patch);

    const session = await fetch(url('/api/auth/session'), { headers: { cookie: jar.header() } });
    expect((await session.json()).user.settings).toEqual({
      timezone: 'America/New_York',
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

    const partialTimezone = await fetch(url('/api/user/settings'), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'csrf-token': csrfToken,
        cookie: jar.header(),
      },
      body: JSON.stringify({ timezone: 'Europe/Warsaw' }),
    });
    expect(partialTimezone.status).toBe(200);
    expect(await partialTimezone.json()).toEqual({
      timezone: 'Europe/Warsaw',
    });

    const unauthenticated = await fetch(url('/api/user/settings'));
    expect(unauthenticated.status).toBe(401);
  });
});
