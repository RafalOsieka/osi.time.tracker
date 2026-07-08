import { describe, expect, it } from 'vitest';
import {
  startTimeEntrySchema,
  updateTimeEntrySchema,
  listTimeEntriesQuerySchema,
  bulkAssignSchema,
  TIME_ENTRY_TITLE_MAX_LENGTH,
} from '../../shared/types/time-entry';

const validProjectId = '018f2f8a-1234-7abc-8def-123456789abc';

describe('startTimeEntrySchema', () => {
  it('accepts an empty body (untitled, project-less entry)', () => {
    const result = startTimeEntrySchema.parse({});
    expect(result.title).toBeUndefined();
    expect(result.projectId).toBeUndefined();
  });

  it('trims the title', () => {
    const result = startTimeEntrySchema.parse({ title: '  Fix the bug  ' });
    expect(result.title).toBe('Fix the bug');
  });

  it('accepts a null title and projectId', () => {
    const result = startTimeEntrySchema.parse({ title: null, projectId: null });
    expect(result.title).toBeNull();
    expect(result.projectId).toBeNull();
  });

  it('rejects a title exceeding the max length', () => {
    const longTitle = 'a'.repeat(TIME_ENTRY_TITLE_MAX_LENGTH + 1);
    expect(() => startTimeEntrySchema.parse({ title: longTitle })).toThrow();
  });

  it('accepts a valid projectId', () => {
    const result = startTimeEntrySchema.parse({ projectId: validProjectId });
    expect(result.projectId).toBe(validProjectId);
  });

  it('rejects an invalid projectId', () => {
    expect(() => startTimeEntrySchema.parse({ projectId: 'not-a-uuid' })).toThrow();
  });
});

describe('updateTimeEntrySchema', () => {
  it('accepts an empty body (no-op update)', () => {
    const result = updateTimeEntrySchema.parse({});
    expect(result.stoppedAt).toBeUndefined();
  });

  it('accepts a valid ISO stoppedAt', () => {
    const iso = new Date().toISOString();
    const result = updateTimeEntrySchema.parse({ stoppedAt: iso });
    expect(result.stoppedAt).toBe(iso);
  });

  it('rejects a non-ISO stoppedAt', () => {
    expect(() => updateTimeEntrySchema.parse({ stoppedAt: 'not-a-date' })).toThrow();
  });

  it('accepts a null stoppedAt (reopen)', () => {
    const result = updateTimeEntrySchema.parse({ stoppedAt: null });
    expect(result.stoppedAt).toBeNull();
  });

  it('rejects an invalid projectId', () => {
    expect(() => updateTimeEntrySchema.parse({ projectId: 'not-a-uuid' })).toThrow();
  });
});

describe('listTimeEntriesQuerySchema', () => {
  const from = '2024-01-01T00:00:00.000Z';
  const to = '2024-01-02T00:00:00.000Z';

  it('accepts a valid from/to range', () => {
    const result = listTimeEntriesQuerySchema.parse({ from, to });
    expect(result).toEqual({ from, to });
  });

  it('rejects a missing from or to', () => {
    expect(() => listTimeEntriesQuerySchema.parse({ to })).toThrow();
    expect(() => listTimeEntriesQuerySchema.parse({ from })).toThrow();
  });

  it('rejects a non-ISO from/to', () => {
    expect(() => listTimeEntriesQuerySchema.parse({ from: 'not-a-date', to })).toThrow();
  });

  it('rejects a range where from >= to', () => {
    expect(() => listTimeEntriesQuerySchema.parse({ from: to, to: from })).toThrow();
    expect(() => listTimeEntriesQuerySchema.parse({ from, to: from })).toThrow();
  });
});

describe('bulkAssignSchema', () => {
  const validId = '018f2f8a-1234-7abc-8def-123456789abc';
  const validProjectId2 = '018f2f8a-4321-7abc-8def-123456789abc';

  it('accepts a valid body', () => {
    const result = bulkAssignSchema.parse({ ids: [validId], title: 'New Title' });
    expect(result.ids).toEqual([validId]);
    expect(result.title).toBe('New Title');
  });

  it('trims the title', () => {
    const result = bulkAssignSchema.parse({ ids: [validId], title: '  Trimmed  ' });
    expect(result.title).toBe('Trimmed');
  });

  it('accepts an optional projectId', () => {
    const result = bulkAssignSchema.parse({
      ids: [validId],
      title: 'Title',
      projectId: validProjectId2,
    });
    expect(result.projectId).toBe(validProjectId2);
  });

  it('rejects an empty ids array', () => {
    expect(() => bulkAssignSchema.parse({ ids: [], title: 'Title' })).toThrow();
  });

  it('rejects a non-uuid id', () => {
    expect(() => bulkAssignSchema.parse({ ids: ['not-a-uuid'], title: 'Title' })).toThrow();
  });

  it('rejects an empty or missing title', () => {
    expect(() => bulkAssignSchema.parse({ ids: [validId], title: '' })).toThrow();
    expect(() => bulkAssignSchema.parse({ ids: [validId], title: '   ' })).toThrow();
    expect(() => bulkAssignSchema.parse({ ids: [validId] })).toThrow();
  });

  it('rejects an invalid projectId', () => {
    expect(() =>
      bulkAssignSchema.parse({ ids: [validId], title: 'Title', projectId: 'not-a-uuid' }),
    ).toThrow();
  });
});
