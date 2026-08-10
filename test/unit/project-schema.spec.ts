import { describe, expect, it } from 'vitest';
import { createProjectSchema, PROJECT_NAME_MAX_LENGTH } from '../../shared/types/project';

const validTrackerId = '018f2f8a-1234-7abc-8def-123456789abc';

describe('createProjectSchema', () => {
  it('parses valid body, trims whitespace, and strips unknown keys', () => {
    const input = {
      name: '  Website Redesign  ',
      trackerId: validTrackerId,
      extraKey: 'should-be-removed',
    };
    const result = createProjectSchema.parse(input);
    expect(result).toEqual({
      name: 'Website Redesign',
      trackerId: validTrackerId,
    });
    expect((result as Record<string, unknown>).extraKey).toBeUndefined();
  });

  it('accepts a local project without trackerId', () => {
    const result = createProjectSchema.parse({ name: 'Local work' });
    expect(result).toEqual({ name: 'Local work' });
  });

  it('accepts null trackerId for an explicit local project', () => {
    const result = createProjectSchema.parse({ name: 'Local', trackerId: null });
    expect(result.trackerId).toBeNull();
  });

  it('fails parse if name is missing', () => {
    const input = { trackerId: validTrackerId };
    expect(() => createProjectSchema.parse(input)).toThrow();
  });

  it('fails parse if name is empty or only whitespace', () => {
    expect(() => createProjectSchema.parse({ name: '', trackerId: validTrackerId })).toThrow();
    expect(() => createProjectSchema.parse({ name: '   ', trackerId: validTrackerId })).toThrow();
  });

  it('fails parse if name exceeds max length', () => {
    const longName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1);
    expect(() =>
      createProjectSchema.parse({ name: longName, trackerId: validTrackerId }),
    ).toThrow();
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH);
    const result = createProjectSchema.parse({ name: maxName, trackerId: validTrackerId });
    expect(result.name).toBe(maxName);
  });

  it('fails parse if trackerId is not a valid uuid', () => {
    expect(() =>
      createProjectSchema.parse({ name: 'Valid Name', trackerId: 'not-a-uuid' }),
    ).toThrow();
  });
});
