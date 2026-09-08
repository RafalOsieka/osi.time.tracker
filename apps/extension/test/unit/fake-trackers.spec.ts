import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startFakeOpenProject,
  startFakeRedmine,
  type FakeTrackerServer,
} from '../browser/harness/fake-trackers.js';

describe('no-CORS fake trackers', () => {
  let openProject: FakeTrackerServer;
  let redmine: FakeTrackerServer;

  beforeAll(async () => {
    openProject = await startFakeOpenProject();
    redmine = await startFakeRedmine();
  });

  afterAll(async () => {
    await openProject.close();
    await redmine.close();
  });

  it('serves OpenProject and Redmine without CORS headers', async () => {
    const openProjectResponse = await fetch(`${openProject.baseUrl}/api/v3`);
    const redmineResponse = await fetch(`${redmine.baseUrl}/users/current.json`);
    expect(openProjectResponse.status).toBe(200);
    expect(redmineResponse.status).toBe(200);
    expect(openProjectResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(redmineResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(await openProjectResponse.json()).toEqual({
      _type: 'Root',
      instanceName: 'fake-openproject',
    });
    expect(await redmineResponse.json()).toEqual({
      user: { id: 7, firstname: 'Ada', lastname: 'Lovelace', login: 'ada' },
    });
  });
});
