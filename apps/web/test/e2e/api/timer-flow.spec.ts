import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin } from '../helpers/session';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';

const describeTimerFlow = requireDocker();

describeTimerFlow('6.3 timer user flow', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('starts with a title, survives a simulated reload, then stops; starting again stops the previous entry', async () => {
    const { jar, token } = await seedAndLogin(dbUrl);

    // Start with a title
    const startRes = await fetch(url('/api/time-entries'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ title: 'Flow Task' }),
    });
    expect(startRes.status).toBe(200);
    const started = await startRes.json();
    expect(started.taskName).toBe('Flow Task');
    expect(started.stoppedAt).toBeNull();

    // Simulate a reload: refetch the running entry
    const runningRes = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    expect(runningRes.status).toBe(200);
    const running = await runningRes.json();
    expect(running.id).toBe(started.id);
    expect(running.taskName).toBe('Flow Task');

    // Stop it
    const stopRes = await fetch(url(`/api/time-entries/${started.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });
    expect(stopRes.status).toBe(200);
    expect((await stopRes.json()).stoppedAt).not.toBeNull();

    const afterStop = await fetch(url('/api/time-entries/running'), {
      headers: { cookie: jar.header() },
    });
    expect(await afterStop.json()).toBeNull();

    // Start a second entry, then start a third while the second is running:
    // the second must be auto-stopped (single-running-entry invariant).
    const second = await (
      await fetch(url('/api/time-entries'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'csrf-token': token,
          cookie: jar.header(),
        },
        body: JSON.stringify({ title: 'Second' }),
      })
    ).json();

    const third = await (
      await fetch(url('/api/time-entries'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'csrf-token': token,
          cookie: jar.header(),
        },
        body: JSON.stringify({ title: 'Third' }),
      })
    ).json();

    const runningNow = await (
      await fetch(url('/api/time-entries/running'), { headers: { cookie: jar.header() } })
    ).json();
    expect(runningNow.id).toBe(third.id);
    expect(runningNow.id).not.toBe(second.id);

    // Cleanup
    await fetch(url(`/api/time-entries/${third.id}`), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    });
  });
});
