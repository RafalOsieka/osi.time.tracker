import { describe, expect, it, vi } from 'vitest';
import { createAccessSessionProbe } from '../../app/utils/access-session-probe';

function setup(fetchSession: () => Promise<Pick<Response, 'type'>>) {
  const reload = vi.fn();
  let time = 1_000_000;
  const probe = createAccessSessionProbe({ fetchSession, reload, now: () => time });
  return {
    probe,
    reload,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('createAccessSessionProbe', () => {
  it('reloads when the session request is redirected', async () => {
    const { probe, reload } = setup(() => Promise.resolve({ type: 'opaqueredirect' }));

    await probe();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('leaves the page alone when the session endpoint answers', async () => {
    const { probe, reload } = setup(() => Promise.resolve({ type: 'basic' }));

    await probe();

    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves the page alone on a network failure', async () => {
    const { probe, reload } = setup(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(probe()).resolves.toBeUndefined();

    expect(reload).not.toHaveBeenCalled();
  });

  it('sends one request per minute across repeated returns', async () => {
    const fetchSession = vi.fn(() => Promise.resolve({ type: 'basic' as const }));
    const { probe, advance } = setup(fetchSession);

    await probe();
    advance(59_999);
    await probe();
    expect(fetchSession).toHaveBeenCalledOnce();

    advance(1);
    await probe();
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });
});
