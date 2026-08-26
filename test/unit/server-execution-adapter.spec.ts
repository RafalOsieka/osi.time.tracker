import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';
import { ServerExecutionAdapter } from '../../app/utils/remote/server-execution-adapter';

const csrfFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $csrfFetch: csrfFetch }));

describe('ServerExecutionAdapter', () => {
  beforeEach(() => {
    csrfFetch.mockReset();
  });

  it('throws when the browser-held secret is missing', async () => {
    const adapter = new ServerExecutionAdapter('tracker-1', null);
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeSecretRequired',
    });
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('returns the parsed account payload', async () => {
    csrfFetch.mockResolvedValue({ id: '1', name: 'Ada' });
    const adapter = new ServerExecutionAdapter('tracker-1', 'secret');
    await expect(adapter.getCurrentAccount()).resolves.toEqual({ id: '1', name: 'Ada' });
  });

  it('maps a schema miss to error.unknown', async () => {
    csrfFetch.mockResolvedValue({ unexpected: true });
    const adapter = new ServerExecutionAdapter('tracker-1', 'secret');
    await expect(adapter.getCurrentAccount()).rejects.toBeInstanceOf(RemoteAdapterError);
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.unknown',
    });
  });

  it('passes RemoteAdapterError through', async () => {
    csrfFetch.mockRejectedValue(new RemoteAdapterError('error.remoteServerModeAuthRejected', 502));
    const adapter = new ServerExecutionAdapter('tracker-1', 'secret');
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeAuthRejected',
    });
  });

  it('maps a generic fetch failure through extractCaughtMessageKey', async () => {
    csrfFetch.mockRejectedValue(new Error('network down'));
    const adapter = new ServerExecutionAdapter('tracker-1', 'secret');
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.unknown',
    });
  });
});
