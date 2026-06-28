import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mapZodError } from '../../server/utils/zod-error';

describe('mapZodError', () => {
  it('maps missing name (invalid_type) to error.clientNameRequired', () => {
    const schema = z.object({
      name: z.string({
        required_error: 'error.clientNameRequired',
        invalid_type_error: 'error.clientNameRequired',
      }),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.clientNameRequired',
        params: { expected: 'string', received: 'undefined' },
      });
    }
  });

  it('maps empty name (too_small) to error.clientNameRequired', () => {
    const schema = z.object({
      name: z.string().min(1, { message: 'error.clientNameRequired' }),
    });
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.clientNameRequired',
        params: { min: 1 },
      });
    }
  });

  it('maps too long name (too_big) to error.clientNameTooLong with params', () => {
    const schema = z.object({
      name: z.string().max(5, { message: 'error.clientNameTooLong' }),
    });
    const result = schema.safeParse({ name: 'abcdef' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.clientNameTooLong',
        params: { max: 5 },
      });
    }
  });

  it('yields fallback errors.unexpected for unmapped issues', () => {
    const schema = z.object({ age: z.number() });
    const result = schema.safeParse({ age: 'not-a-number' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({ messageKey: 'errors.unexpected' });
    }
  });
});
