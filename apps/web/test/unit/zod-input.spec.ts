import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

type MappedHttpError = Error & { statusCode: number; data: unknown };

const { readBody, getQuery, createError } = vi.hoisted(() => {
  const createError = vi.fn((opts: { statusCode: number; data: unknown }): MappedHttpError => {
    return Object.assign(new Error('createError'), opts);
  });
  return {
    readBody: vi.fn(),
    getQuery: vi.fn(),
    createError,
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking -- h3 request helpers are not a project seam
vi.mock('h3', () => ({
  readBody,
  getQuery,
  createError,
}));

const { readZodBody, getZodQuery } = await import('../../server/utils/zod-input');

const schema = z.object({
  name: z
    .string({ error: 'error.trackerNameRequired' })
    .min(1, { error: 'error.trackerNameRequired' }),
});

// SAFETY: readBody/getQuery are mocked; the event object is only forwarded.
const event = {} as Parameters<typeof readZodBody>[0];

describe('readZodBody', () => {
  beforeEach(() => {
    readBody.mockReset();
    createError.mockClear();
  });

  it('returns parsed body on success', async () => {
    readBody.mockResolvedValue({ name: 'Acme' });
    await expect(readZodBody(event, schema)).resolves.toEqual({ name: 'Acme' });
  });

  it('maps ZodError to a 422 createError with messageKey', async () => {
    readBody.mockResolvedValue({});
    await expect(readZodBody(event, schema)).rejects.toMatchObject({
      statusCode: 422,
      data: { messageKey: 'error.trackerNameRequired' },
    });
  });

  it('uses a custom statusCode (login 400)', async () => {
    readBody.mockResolvedValue({});
    await expect(readZodBody(event, schema, 400)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rethrows non-Zod failures', async () => {
    readBody.mockRejectedValue(new TypeError('invalid json'));
    await expect(readZodBody(event, schema)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('getZodQuery', () => {
  beforeEach(() => {
    getQuery.mockReset();
    createError.mockClear();
  });

  it('returns parsed query on success', async () => {
    getQuery.mockReturnValue({ name: 'Acme' });
    await expect(getZodQuery(event, schema)).resolves.toEqual({ name: 'Acme' });
  });

  it('maps ZodError to a 422 createError with messageKey', async () => {
    getQuery.mockReturnValue({});
    await expect(getZodQuery(event, schema)).rejects.toMatchObject({
      statusCode: 422,
      data: { messageKey: 'error.trackerNameRequired' },
    });
  });
});
