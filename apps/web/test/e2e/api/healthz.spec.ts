import { expect, it } from 'vitest';
import { healthSchema } from '../../../shared/types/health';
import { requireDocker } from '../harness/guards';
import { provisionDatabase } from '../harness/database';
import { setupServer } from '../harness/setup-server';
import { url } from '../helpers/url';

const describeHealth = requireDocker();

describeHealth('GET /healthz', async () => {
  const databaseUrl = await provisionDatabase();
  await setupServer({ databaseUrl });

  it('answers without a session and reports dev for a build without a commit', async () => {
    const response = await fetch(url('/healthz'));

    expect(response.status).toBe(200);
    expect(healthSchema.parse(await response.json())).toEqual({ commit: 'dev' });
  });
});
