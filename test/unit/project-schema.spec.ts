import { describe, expect, it } from 'vitest';
import { createProjectSchema, PROJECT_NAME_MAX_LENGTH } from '../../shared/types/project';

const validClientId = '018f2f8a-1234-7abc-8def-123456789abc';

describe('createProjectSchema', () => {
  it('parses valid body, trims whitespace, and strips unknown keys', () => {
    const input = {
      name: '  Website Redesign  ',
      clientId: validClientId,
      extraKey: 'should-be-removed',
    };
    const result = createProjectSchema.parse(input);
    expect(result).toEqual({
      name: 'Website Redesign',
      clientId: validClientId,
    });
    expect((result as Record<string, unknown>).extraKey).toBeUndefined();
  });

  it('fails parse if name is missing', () => {
    const input = { clientId: validClientId };
    expect(() => createProjectSchema.parse(input)).toThrow();
  });

  it('fails parse if name is empty or only whitespace', () => {
    expect(() => createProjectSchema.parse({ name: '', clientId: validClientId })).toThrow();
    expect(() => createProjectSchema.parse({ name: '   ', clientId: validClientId })).toThrow();
  });

  it('fails parse if name exceeds max length', () => {
    const longName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1);
    expect(() => createProjectSchema.parse({ name: longName, clientId: validClientId })).toThrow();
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH);
    const result = createProjectSchema.parse({ name: maxName, clientId: validClientId });
    expect(result.name).toBe(maxName);
  });

  it('fails parse if clientId is missing', () => {
    expect(() => createProjectSchema.parse({ name: 'Valid Name' })).toThrow();
  });

  it('fails parse if clientId is not a valid uuid', () => {
    expect(() =>
      createProjectSchema.parse({ name: 'Valid Name', clientId: 'not-a-uuid' }),
    ).toThrow();
  });
});
