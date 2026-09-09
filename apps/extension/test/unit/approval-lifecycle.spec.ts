import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_STORAGE_KEY } from '../../src/approvals/chrome-store.js';
import { contentScriptId } from '../../src/content/registration.js';

function event<T extends (...args: never[]) => void>() {
  const listeners = new Set<T>();
  return {
    listeners,
    addListener: (listener: T) => {
      listeners.add(listener);
    },
    removeListener: (listener: T) => {
      listeners.delete(listener);
    },
  };
}

function browser() {
  const origin = 'https://osi.example.com';
  const tracker = 'http://tracker.internal';
  const onStartup = event<() => void>();
  const onInstalled = event<() => void>();
  const onChanged = event<Parameters<ChromeStorageChanges['addListener']>[0]>();
  const onRemoved = event<Parameters<ChromePermissionChanges['addListener']>[0]>();
  const granted = new Set([`${origin}/*`, `${tracker}/*`, 'https://stale.example.com/*']);
  let saved: ChromeJson = {
    websites: [{ origin }],
    destinations: [{ websiteOrigin: origin, origin: tracker, provider: 'redmine', basePath: '' }],
  };
  const local: ChromeStorageArea = {
    get: async () => ({ [APPROVAL_STORAGE_KEY]: saved }),
    set: async (items) => {
      saved = items[APPROVAL_STORAGE_KEY]!;
      for (const listener of onChanged.listeners) {
        listener({ [APPROVAL_STORAGE_KEY]: { newValue: saved } }, 'local');
      }
    },
  };
  const registered = new Set([contentScriptId('https://stale.example.com')]);
  const scripting: ChromeScripting = {
    getRegisteredContentScripts: async () => [...registered].map((id) => ({ id })),
    registerContentScripts: async (scripts) => {
      for (const script of scripts) registered.add(script.id);
    },
    unregisterContentScripts: async ({ ids }) => {
      for (const id of ids) registered.delete(id);
    },
  };
  const permissions: ChromePermissions = {
    onAdded: event<Parameters<ChromePermissionChanges['addListener']>[0]>(),
    onRemoved,
    contains: async ({ origins }) => origins.every((pattern) => granted.has(pattern)),
    getAll: async () => ({ origins: [...granted] }),
    request: async () => false,
    remove: async ({ origins }) => {
      for (const pattern of origins) granted.delete(pattern);
      for (const listener of onRemoved.listeners) listener({ origins });
      return true;
    },
  };
  vi.stubGlobal('chrome', {
    runtime: { id: 'test-extension', onStartup, onInstalled, onConnect: event<() => void>() },
    storage: { local, onChanged },
    permissions,
    scripting,
  });
  return { origin, tracker, onStartup, onInstalled, permissions, registered, granted, local };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('background approval lifecycle with settings closed', () => {
  it('reconciles registrations and unused permissions on worker load', async () => {
    const context = browser();
    await import('../../src/background.js');
    await vi.waitFor(() =>
      expect([...context.registered]).toEqual([contentScriptId(context.origin)]),
    );
    expect([...context.granted]).toEqual([`${context.origin}/*`, `${context.tracker}/*`]);
  });

  it.each(['onStartup', 'onInstalled'] as const)(
    'registers %s synchronously and repairs scripts',
    async (name) => {
      const context = browser();
      await import('../../src/background.js');
      expect(context[name].listeners.size).toBe(1);
      await vi.waitFor(() =>
        expect(context.registered.has(contentScriptId(context.origin))).toBe(true),
      );
      context.registered.clear();
      for (const listener of context[name].listeners) listener();
      await vi.waitFor(() =>
        expect(context.registered.has(contentScriptId(context.origin))).toBe(true),
      );
    },
  );

  it.each(['website', 'tracker'] as const)(
    'preserves approvals for restoration after browser %s permission removal',
    async (scope) => {
      const context = browser();
      await import('../../src/background.js');
      expect(context.permissions.onRemoved).toMatchObject({ addListener: expect.any(Function) });
      await context.permissions.remove({
        origins: [`${scope === 'website' ? context.origin : context.tracker}/*`],
      });
      await vi.waitFor(() =>
        expect([...context.registered]).toEqual(
          scope === 'website' ? [] : [contentScriptId(context.origin)],
        ),
      );
      await vi.waitFor(async () =>
        expect(await context.local.get(APPROVAL_STORAGE_KEY)).toEqual({
          [APPROVAL_STORAGE_KEY]: {
            websites: [{ origin: context.origin }],
            destinations: [
              {
                websiteOrigin: context.origin,
                origin: context.tracker,
                provider: 'redmine',
                basePath: '',
              },
            ],
          },
        }),
      );
    },
  );
});
