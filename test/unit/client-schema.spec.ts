import { describe, expect, it } from 'vitest';
import { createClientBodySchema, CLIENT_NAME_MAX_LENGTH } from '../../shared/types/client';

describe('createClientBodySchema', () => {
  it('parses valid body, trims whitespace, and strips unknown keys', () => {
    const input = {
      name: '  Acme Corporation  ',
      extraKey: 'should-be-removed',
    };
    const result = createClientBodySchema.parse(input);
    expect(result).toEqual({
      name: 'Acme Corporation',
    });
    expect((result as Record<string, unknown>).extraKey).toBeUndefined();
  });

  it('fails parse if name is missing', () => {
    const input = {};
    expect(() => createClientBodySchema.parse(input)).toThrow();
  });

  it('fails parse if name is empty or only whitespace', () => {
    expect(() => createClientBodySchema.parse({ name: '' })).toThrow();
    expect(() => createClientBodySchema.parse({ name: '   ' })).toThrow();
  });

  it('fails parse if name exceeds max length', () => {
    const longName = 'a'.repeat(CLIENT_NAME_MAX_LENGTH + 1);
    expect(() => createClientBodySchema.parse({ name: longName })).toThrow();
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(CLIENT_NAME_MAX_LENGTH);
    const result = createClientBodySchema.parse({ name: maxName });
    expect(result.name).toBe(maxName);
  });
});
