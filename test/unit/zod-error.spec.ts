import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mapZodError } from '../../server/utils/zod-error';

describe('mapZodError', () => {
  it('maps missing name (invalid_type) to error.trackerNameRequired', () => {
    const schema = z.object({
      name: z.string({ error: 'error.trackerNameRequired' }),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.trackerNameRequired',
        params: { expected: 'string' },
      });
      expect(mapped.params).not.toHaveProperty('received');
    }
  });

  it('maps empty name (too_small) to error.trackerNameRequired', () => {
    const schema = z.object({
      name: z.string().min(1, { error: 'error.trackerNameRequired' }),
    });
    const result = schema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.trackerNameRequired',
        params: { min: 1 },
      });
    }
  });

  it('maps too long name (too_big) to error.trackerNameTooLong with params', () => {
    const schema = z.object({
      name: z.string().max(5, { error: 'error.trackerNameTooLong' }),
    });
    const result = schema.safeParse({ name: 'abcdef' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.trackerNameTooLong',
        params: { max: 5 },
      });
    }
  });

  it('does not emit received on invalid_type issues', () => {
    const schema = z.object({
      name: z.string({ error: 'error.trackerNameRequired' }),
    });
    const result = schema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped.messageKey).toBe('error.trackerNameRequired');
      expect(mapped.params).toEqual({ expected: 'string' });
      expect(mapped.params).not.toHaveProperty('received');
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
