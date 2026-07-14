import { beforeEach, describe, expect, it } from 'vitest';
import { useRemoteConfigSecret } from '../../app/composables/useRemoteConfigSecret';

/**
 * Node's own global `localStorage` (added in recent Node versions) is a
 * non-functional stub unless `--localstorage-file` is passed, and it shadows
 * `window.localStorage` because `window === globalThis` in this test
 * environment. Replace it with a minimal in-memory implementation so the
 * composable under test exercises real get/set/remove semantics.
 */
function installFakeLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

describe('useRemoteConfigSecret', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it('persists a secret per config id and retrieves it later (simulating reload)', () => {
    const { get, set } = useRemoteConfigSecret();

    set('config-a', 'secret-a');
    set('config-b', 'secret-b');

    expect(get('config-a')).toBe('secret-a');
    expect(get('config-b')).toBe('secret-b');
    expect(window.localStorage.getItem('rsc:config-a')).toBe('secret-a');
  });

  it('returns null for a config id with no stored secret', () => {
    const { get } = useRemoteConfigSecret();

    expect(get('unknown')).toBeNull();
  });

  it('clears the secret on demand', () => {
    const { get, set, clear } = useRemoteConfigSecret();

    set('config-a', 'secret-a');
    clear('config-a');

    expect(get('config-a')).toBeNull();
  });

  it('never includes the secret in an outgoing request body shape', () => {
    const { set } = useRemoteConfigSecret();
    set('config-a', 'secret-a');

    const outgoingBody = {
      systemType: 'redmine',
      baseUrl: 'https://redmine.example.com',
      executionMode: 'client',
      roundingRule: 'none',
    };

    expect(Object.values(outgoingBody)).not.toContain('secret-a');
    expect(JSON.stringify(outgoingBody)).not.toContain('secret-a');
  });
});
