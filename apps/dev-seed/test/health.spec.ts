import { describe, expect, it } from 'vitest';
import { parseComposePs, TrackersNotHealthyError, waitForTrackers } from '../src/health.js';

const row = (service: string, state: string, health?: string) =>
  JSON.stringify({ Service: service, State: state, Health: health ?? '' });

describe('parseComposePs', () => {
  it('reports healthy, starting, unhealthy and absent tracker services', () => {
    const stdout = [
      row('db', 'running', 'healthy'),
      row('openproject', 'running', 'healthy'),
      row('redmine', 'running', 'starting'),
    ].join('\n');
    expect(parseComposePs(stdout)).toEqual([
      { service: 'openproject', state: 'healthy' },
      { service: 'redmine', state: 'starting' },
    ]);
    expect(parseComposePs('')).toEqual([
      { service: 'openproject', state: 'absent' },
      { service: 'redmine', state: 'absent' },
    ]);
    expect(parseComposePs(row('redmine', 'running', 'unhealthy'))[1]).toEqual({
      service: 'redmine',
      state: 'unhealthy',
    });
    expect(parseComposePs(row('openproject', 'exited'))[0]?.state).toBe('absent');
  });
});

describe('waitForTrackers', () => {
  const options = (clock: { t: number }) => ({
    timeoutMs: 1000,
    pollMs: 100,
    sleep: async () => {
      clock.t += 100;
    },
    now: () => clock.t,
  });

  it('returns once both services are healthy', async () => {
    const clock = { t: 0 };
    const outputs = [
      [row('openproject', 'running', 'starting'), row('redmine', 'running', 'healthy')].join('\n'),
      [row('openproject', 'running', 'healthy'), row('redmine', 'running', 'healthy')].join('\n'),
    ];
    let calls = 0;
    const statuses = await waitForTrackers(async () => outputs[calls++] ?? '', options(clock));
    expect(statuses.every((status) => status.state === 'healthy')).toBe(true);
    expect(calls).toBe(2);
  });

  it('fails immediately naming an absent service', async () => {
    const clock = { t: 0 };
    await expect(
      waitForTrackers(async () => row('openproject', 'running', 'healthy'), options(clock)),
    ).rejects.toThrow(/redmine is absent/);
    expect(clock.t).toBe(0);
  });

  it('fails after the timeout while a service is still starting', async () => {
    const clock = { t: 0 };
    const starting = [
      row('openproject', 'running', 'starting'),
      row('redmine', 'running', 'healthy'),
    ].join('\n');
    const failure = await waitForTrackers(async () => starting, options(clock)).catch(
      (err: Error) => err,
    );
    expect(failure).toBeInstanceOf(TrackersNotHealthyError);
    expect(String(failure)).toMatch(/openproject is starting/);
    expect(clock.t).toBeGreaterThanOrEqual(1000);
  });
});
