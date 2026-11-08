import { describe, expect, it } from 'vitest';
import { readHealth } from '../../server/utils/health';

describe('readHealth', () => {
  it('reports the commit while the database answers', async () => {
    await expect(readHealth(() => Promise.resolve(), 'abc123')).resolves.toEqual({
      commit: 'abc123',
    });
  });

  it('answers 503 with a message key and no commit when the database fails', async () => {
    const failedRead = () =>
      readHealth(() => Promise.reject(new Error('connection refused')), 'abc123');

    await expect(failedRead()).rejects.toMatchObject({
      statusCode: 503,
      data: { messageKey: 'error.databaseUnavailable' },
    });
    await expect(failedRead()).rejects.not.toHaveProperty('commit');
  });
});
