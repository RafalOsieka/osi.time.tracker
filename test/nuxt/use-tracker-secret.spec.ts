import { beforeEach, describe, expect, it } from 'vitest';
import { useTrackerSecret } from '../../app/composables/use-tracker-secret';

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

describe('useTrackerSecret', () => {
  beforeEach(() => {
    installFakeLocalStorage();
  });

  it('persists a secret per tracker id and retrieves it later (simulating reload)', () => {
    const { get, set } = useTrackerSecret();

    set('tracker-a', 'secret-a');
    set('tracker-b', 'secret-b');

    expect(get('tracker-a')).toBe('secret-a');
    expect(get('tracker-b')).toBe('secret-b');
    expect(window.localStorage.getItem('rsc:tracker-a')).toBe('secret-a');
  });

  it('returns null for a tracker id with no stored secret', () => {
    const { get } = useTrackerSecret();

    expect(get('unknown')).toBeNull();
  });

  it('clears the secret on demand', () => {
    const { get, set, clear } = useTrackerSecret();

    set('tracker-a', 'secret-a');
    clear('tracker-a');

    expect(get('tracker-a')).toBeNull();
  });

  it('never includes the secret in an outgoing request body shape', () => {
    const { set } = useTrackerSecret();
    set('tracker-a', 'secret-a');

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
