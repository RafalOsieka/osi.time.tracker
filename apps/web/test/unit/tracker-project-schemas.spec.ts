import { describe, expect, it } from 'vitest';
import { createTrackerSchema } from '../../shared/types/tracker';
import { createProjectSchema } from '../../shared/types/project';

describe('createTrackerSchema', () => {
  it('accepts a valid tracker payload and defaults executionMode to client', () => {
    const parsed = createTrackerSchema.parse({
      name: ' OpenProject A ',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      roundingRule: 'up_15m',
    });
    expect(parsed).toEqual({
      name: 'OpenProject A',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      executionMode: 'client',
      roundingRule: 'up_15m',
    });
  });

  it('rejects empty name with tracker messageKey', () => {
    const result = createTrackerSchema.safeParse({
      name: '   ',
      systemType: 'redmine',
      baseUrl: 'https://rm.example.com',
      roundingRule: 'none',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('error.trackerNameRequired');
    }
  });

  it('rejects invalid base URL', () => {
    const result = createTrackerSchema.safeParse({
      name: 'Broken',
      systemType: 'openproject',
      baseUrl: 'not-a-url',
      roundingRule: 'none',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === 'error.trackerBaseUrlInvalid')).toBe(
        true,
      );
    }
  });
});

describe('createProjectSchema', () => {
  it('accepts a local project without trackerId', () => {
    const parsed = createProjectSchema.parse({ name: ' Local work ' });
    expect(parsed).toEqual({ name: 'Local work' });
  });

  it('accepts null trackerId for an explicit local project', () => {
    const parsed = createProjectSchema.parse({ name: 'Local', trackerId: null });
    expect(parsed.trackerId).toBeNull();
  });

  it('accepts a uuid trackerId', () => {
    const trackerId = '01900000-0000-7000-8000-000000000001';
    const parsed = createProjectSchema.parse({ name: 'Linked', trackerId });
    expect(parsed.trackerId).toBe(trackerId);
  });

  it('rejects invalid tracker uuid', () => {
    const result = createProjectSchema.safeParse({ name: 'Bad', trackerId: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('error.projectTrackerInvalid');
    }
  });
});
