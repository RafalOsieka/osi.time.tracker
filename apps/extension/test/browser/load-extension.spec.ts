import { existsSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  extensionDistPath,
  launchExtensionContext,
  type ExtensionHarness,
} from './harness/extension-context.js';
import {
  startFakeOpenProject,
  startFakeRedmine,
  type FakeTrackerServer,
} from './harness/fake-trackers.js';
import { requireChromium } from './harness/skip.js';

const describeChromium = requireChromium();

describeChromium('extension browser harness', () => {
  let openProject: FakeTrackerServer;
  let redmine: FakeTrackerServer;
  let harness: ExtensionHarness | undefined;

  beforeAll(async () => {
    expect(existsSync(extensionDistPath())).toBe(true);
    openProject = await startFakeOpenProject();
    redmine = await startFakeRedmine();
    harness = await launchExtensionContext();
  });

  afterAll(async () => {
    await harness?.close();
    await openProject.close();
    await redmine.close();
  });

  it('loads the unpacked extension and reaches no-CORS tracker fixtures', async () => {
    expect(harness?.worker).toBeDefined();

    const openProjectResponse = await fetch(`${openProject.baseUrl}/api/v3`);
    const redmineResponse = await fetch(`${redmine.baseUrl}/users/current.json`);
    expect(openProjectResponse.status).toBe(200);
    expect(redmineResponse.status).toBe(200);
    expect(openProjectResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(redmineResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(openProject.requests.length).toBeGreaterThan(0);
    expect(redmine.requests.length).toBeGreaterThan(0);
  });
});
