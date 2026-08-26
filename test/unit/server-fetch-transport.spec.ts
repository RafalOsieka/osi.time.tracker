import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createServerFetchTransport } from '../../server/utils/remote/server-fetch-transport';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';

const unusedPayloadSchema = z.object({}).passthrough();

describe('createServerFetchTransport', () => {
  it('rejects a foreign-origin request with the origin-rejected messageKey without calling out', async () => {
    const transport = createServerFetchTransport('https://op.example.com');

    await expect(
      transport.execute(
        { url: 'https://evil.example.com/api/v3/work_packages', method: 'GET' },
        unusedPayloadSchema,
      ),
    ).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeOriginRejected',
    });
  });

  it('rejects a malformed target URL the same way', async () => {
    const transport = createServerFetchTransport('https://op.example.com');

    await expect(
      transport.execute({ url: 'not-a-url', method: 'GET' }, unusedPayloadSchema),
    ).rejects.toBeInstanceOf(RemoteAdapterError);
  });

  it('rejects a next-page link pointing off-origin, even with a trailing slash on the base URL', async () => {
    const transport = createServerFetchTransport('https://op.example.com/');

    await expect(
      transport.execute(
        {
          url: 'https://attacker.example.com/api/v3/time_entries?offset=2',
          method: 'GET',
        },
        unusedPayloadSchema,
      ),
    ).rejects.toMatchObject({ messageKey: 'error.remoteServerModeOriginRejected' });
  });

  it('rejects foreign origins before applying any caller-supplied headers', async () => {
    const transport = createServerFetchTransport('https://op.example.com');

    await expect(
      transport.execute(
        {
          url: 'https://evil.example.com/api',
          method: 'GET',
          headers: { 'X-Redmine-API-Key': 'secret', Authorization: 'Basic abc' },
        },
        unusedPayloadSchema,
      ),
    ).rejects.toMatchObject({ messageKey: 'error.remoteServerModeOriginRejected' });
  });
});
