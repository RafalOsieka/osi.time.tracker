import { describe, expect, it } from 'vitest';
import { contentScriptId, reconcileWebsiteContentScripts } from '../../src/content/registration.js';

describe('content registration reconciliation', () => {
  it('serializes settings and background reconciliation to avoid duplicate registrations', async () => {
    const registered = new Set<string>();
    const scripting: ChromeScripting = {
      getRegisteredContentScripts: async () => [...registered].map((id) => ({ id })),
      registerContentScripts: async (scripts) => {
        for (const script of scripts) {
          if (registered.has(script.id)) throw new Error('Duplicate script ID');
          registered.add(script.id);
        }
      },
      unregisterContentScripts: async ({ ids }) => {
        for (const id of ids) registered.delete(id);
      },
    };
    const origins = ['https://osi.example.com'];
    await Promise.all([
      reconcileWebsiteContentScripts(origins, scripting),
      reconcileWebsiteContentScripts(origins, scripting),
    ]);
    expect([...registered]).toEqual([contentScriptId(origins[0]!)]);
  });
});
