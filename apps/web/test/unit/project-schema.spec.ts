import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH,
  PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH,
} from '../../shared/types/project';

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
    expect('extraKey' in result).toBe(false);
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

  it('accepts a valid remote project scope pair', () => {
    const result = createProjectSchema.parse({
      name: 'Scoped',
      trackerId: validTrackerId,
      remoteProjectId: '  3  ',
      remoteProjectTitle: '  Spike Root  ',
    });
    expect(result.remoteProjectId).toBe('3');
    expect(result.remoteProjectTitle).toBe('Spike Root');
  });

  it('accepts no scope (both omitted or both null)', () => {
    expect(
      createProjectSchema.parse({ name: 'Unscoped', trackerId: validTrackerId }).remoteProjectId,
    ).toBeUndefined();
    const result = createProjectSchema.parse({
      name: 'Unscoped',
      trackerId: validTrackerId,
      remoteProjectId: null,
      remoteProjectTitle: null,
    });
    expect(result.remoteProjectId).toBeNull();
    expect(result.remoteProjectTitle).toBeNull();
  });

  it('rejects a half-set scope in either direction', () => {
    expect(() =>
      createProjectSchema.parse({
        name: 'Half',
        trackerId: validTrackerId,
        remoteProjectId: '3',
      }),
    ).toThrow();
    expect(() =>
      createProjectSchema.parse({
        name: 'Half',
        trackerId: validTrackerId,
        remoteProjectTitle: 'Spike Root',
      }),
    ).toThrow();
  });

  it('rejects a blank or over-length remote project id or title', () => {
    expect(() =>
      createProjectSchema.parse({
        name: 'Blank id',
        trackerId: validTrackerId,
        remoteProjectId: '   ',
        remoteProjectTitle: 'Spike Root',
      }),
    ).toThrow();
    expect(() =>
      createProjectSchema.parse({
        name: 'Long id',
        trackerId: validTrackerId,
        remoteProjectId: 'a'.repeat(PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH + 1),
        remoteProjectTitle: 'Spike Root',
      }),
    ).toThrow();
    expect(() =>
      createProjectSchema.parse({
        name: 'Long title',
        trackerId: validTrackerId,
        remoteProjectId: '3',
        remoteProjectTitle: 'a'.repeat(PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it('accepts scope fields at exactly the max length', () => {
    const result = createProjectSchema.parse({
      name: 'Max length scope',
      trackerId: validTrackerId,
      remoteProjectId: 'a'.repeat(PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH),
      remoteProjectTitle: 'a'.repeat(PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH),
    });
    expect(result.remoteProjectId).toHaveLength(PROJECT_REMOTE_PROJECT_ID_MAX_LENGTH);
    expect(result.remoteProjectTitle).toHaveLength(PROJECT_REMOTE_PROJECT_TITLE_MAX_LENGTH);
  });
});

describe('listProjectsQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(listProjectsQuerySchema.parse({})).toEqual({});
  });

  it('accepts trackerId filter tokens used by the list endpoint', () => {
    expect(listProjectsQuerySchema.parse({ trackerId: 'local' })).toEqual({ trackerId: 'local' });
    expect(listProjectsQuerySchema.parse({ trackerId: 'null' })).toEqual({ trackerId: 'null' });
    expect(listProjectsQuerySchema.parse({ trackerId: validTrackerId })).toEqual({
      trackerId: validTrackerId,
    });
  });
});
