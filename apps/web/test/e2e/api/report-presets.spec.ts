import { expect, it } from 'vitest';
import { url } from '../helpers/url';
import { seedAndLogin, type SeededSession } from '../helpers/session';
import { createTracker } from '../helpers/http';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { UNKNOWN_ID } from '../helpers/fixtures';
import type { ReportPresetDto, ReportPresetInput } from '../../../shared/types/report-preset';

const describeReportPresets = requireDocker();

type Session = Pick<SeededSession, 'jar' | 'token'>;

function presetBody(
  trackerIds: string[],
  overrides: Partial<ReportPresetInput> = {},
): ReportPresetInput {
  return {
    clientName: 'Helios Energy',
    trackerIds,
    hoursFormat: 'decimal',
    locale: 'pl',
    ...overrides,
  };
}

async function send(
  { jar, token }: Session,
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: ReportPresetInput,
): Promise<Response> {
  return fetch(url(path), {
    method,
    headers: { 'content-type': 'application/json', 'csrf-token': token, cookie: jar.header() },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function listPresets({ jar }: Session): Promise<ReportPresetDto[]> {
  const res = await fetch(url('/api/report-presets'), { headers: { cookie: jar.header() } });
  expect(res.status).toBe(200);
  return res.json();
}

async function createPreset(
  session: Session,
  trackerIds: string[],
  overrides: Partial<ReportPresetInput> = {},
): Promise<ReportPresetDto> {
  const res = await send(session, 'POST', '/api/report-presets', presetBody(trackerIds, overrides));
  expect(res.status).toBe(200);
  return res.json();
}

describeReportPresets('report presets API integration', async () => {
  const dbUrl = await provisionDatabase();
  await setupServer({ databaseUrl: dbUrl });

  it('creates a preset marked as used, with its trackers in order', async () => {
    const session = await seedAndLogin(dbUrl);
    const op = await createTracker(session.jar, session.token, 'OP');
    const redmine = await createTracker(session.jar, session.token, 'Redmine');

    const before = Date.now();
    const created = await createPreset(session, [redmine.id, op.id], {
      clientName: '  Helios Energy  ',
    });

    expect(created).toMatchObject({
      clientName: 'Helios Energy',
      trackers: [
        { id: redmine.id, name: 'Redmine' },
        { id: op.id, name: 'OP' },
      ],
      inactiveTrackerCount: 0,
      hoursFormat: 'decimal',
      locale: 'pl',
    });
    expect(Date.parse(created.lastUsedAt!)).toBeGreaterThanOrEqual(before - 1000);
    expect(await listPresets(session)).toEqual([created]);
  });

  it('lists the most recently used preset first and isolates foreign presets', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const tracker = await createTracker(alice.jar, alice.token, 'OP');
    const bobTracker = await createTracker(bob.jar, bob.token, 'Bob OP');
    await createPreset(bob, [bobTracker.id], { clientName: 'Bob Client' });

    const a = await createPreset(alice, [tracker.id], { clientName: 'A' });
    const b = await createPreset(alice, [tracker.id], { clientName: 'B' });
    expect((await listPresets(alice)).map((preset) => preset.id)).toEqual([b.id, a.id]);

    const reused = await send(alice, 'PATCH', `/api/report-presets/${a.id}`, {
      ...presetBody([tracker.id]),
      clientName: 'A',
    });
    expect(reused.status).toBe(200);
    expect((await listPresets(alice)).map((preset) => preset.id)).toEqual([a.id, b.id]);
  });

  it('reports soft-deleted trackers instead of listing them', async () => {
    const session = await seedAndLogin(dbUrl);
    const op = await createTracker(session.jar, session.token, 'OP');
    const redmine = await createTracker(session.jar, session.token, 'Redmine');
    const preset = await createPreset(session, [op.id, redmine.id]);

    const deleted = await send(session, 'DELETE', `/api/trackers/${redmine.id}`);
    expect(deleted.status).toBe(200);

    const [listed] = await listPresets(session);
    expect(listed).toMatchObject({
      id: preset.id,
      trackers: [{ id: op.id, name: 'OP' }],
      inactiveTrackerCount: 1,
    });
  });

  it('update replaces the client name, trackers, order, and locale', async () => {
    const session = await seedAndLogin(dbUrl);
    const op = await createTracker(session.jar, session.token, 'OP');
    const redmine = await createTracker(session.jar, session.token, 'Redmine');
    const third = await createTracker(session.jar, session.token, 'Third');
    const preset = await createPreset(session, [op.id, redmine.id]);

    const res = await send(
      session,
      'PATCH',
      `/api/report-presets/${preset.id}`,
      presetBody([third.id, op.id], { clientName: 'Nordwind', locale: 'en', hoursFormat: 'hm' }),
    );
    expect(res.status).toBe(200);
    const updated: ReportPresetDto = await res.json();
    expect(updated).toMatchObject({
      id: preset.id,
      clientName: 'Nordwind',
      trackers: [
        { id: third.id, name: 'Third' },
        { id: op.id, name: 'OP' },
      ],
      hoursFormat: 'hm',
      locale: 'en',
    });
    expect(await listPresets(session)).toEqual([updated]);
  });

  it('rejects foreign, unknown, and deleted trackers with 422 and persists nothing', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const own = await createTracker(alice.jar, alice.token, 'OP');
    const removed = await createTracker(alice.jar, alice.token, 'Removed');
    await send(alice, 'DELETE', `/api/trackers/${removed.id}`);
    const foreign = await createTracker(bob.jar, bob.token, 'Bob OP');

    for (const trackerId of [foreign.id, UNKNOWN_ID, removed.id]) {
      const res = await send(alice, 'POST', '/api/report-presets', presetBody([own.id, trackerId]));
      expect(res.status).toBe(422);
      expect((await res.json())?.data?.messageKey).toBe('error.reportPresetTrackerInvalid');
    }

    const invalid = await send(alice, 'POST', '/api/report-presets', presetBody([]));
    expect(invalid.status).toBe(422);
    expect((await invalid.json())?.data?.messageKey).toBe('error.reportPresetTrackersRequired');

    expect(await listPresets(alice)).toEqual([]);
  });

  it('rejects a client name that differs only in case with 409', async () => {
    const session = await seedAndLogin(dbUrl);
    const tracker = await createTracker(session.jar, session.token, 'OP');
    await createPreset(session, [tracker.id], { clientName: 'helios energy' });
    const other = await createPreset(session, [tracker.id], { clientName: 'Nordwind' });

    const created = await send(session, 'POST', '/api/report-presets', presetBody([tracker.id]));
    expect(created.status).toBe(409);
    expect((await created.json())?.data?.messageKey).toBe('error.reportPresetClientNameDuplicate');

    const renamed = await send(
      session,
      'PATCH',
      `/api/report-presets/${other.id}`,
      presetBody([tracker.id]),
    );
    expect(renamed.status).toBe(409);
    expect((await listPresets(session)).map((preset) => preset.clientName).sort()).toEqual([
      'Nordwind',
      'helios energy',
    ]);
  });

  it('returns 404 for foreign or unknown presets on update and delete', async () => {
    const alice = await seedAndLogin(dbUrl);
    const bob = await seedAndLogin(dbUrl);
    const aliceTracker = await createTracker(alice.jar, alice.token, 'OP');
    const bobTracker = await createTracker(bob.jar, bob.token, 'Bob OP');
    const alicePreset = await createPreset(alice, [aliceTracker.id]);

    for (const id of [alicePreset.id, UNKNOWN_ID]) {
      const patched = await send(
        bob,
        'PATCH',
        `/api/report-presets/${id}`,
        presetBody([bobTracker.id]),
      );
      expect(patched.status).toBe(404);
      const deleted = await send(bob, 'DELETE', `/api/report-presets/${id}`);
      expect(deleted.status).toBe(404);
    }

    expect(await listPresets(alice)).toEqual([alicePreset]);
  });

  it('delete removes the preset from the list', async () => {
    const session = await seedAndLogin(dbUrl);
    const tracker = await createTracker(session.jar, session.token, 'OP');
    const preset = await createPreset(session, [tracker.id]);

    const res = await send(session, 'DELETE', `/api/report-presets/${preset.id}`);
    expect(res.status).toBe(200);
    expect(await listPresets(session)).toEqual([]);
  });

  it('requires a session and a CSRF token', async () => {
    const session = await seedAndLogin(dbUrl);
    const tracker = await createTracker(session.jar, session.token, 'OP');

    const unauthenticated = await fetch(url('/api/report-presets'));
    expect(unauthenticated.status).toBe(401);

    const withoutCsrf = await fetch(url('/api/report-presets'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session.jar.header() },
      body: JSON.stringify(presetBody([tracker.id])),
    });
    expect(withoutCsrf.ok).toBe(false);
    expect(await listPresets(session)).toEqual([]);
  });
});
