import { describe, expect, it } from 'vitest';
import {
  startTimeEntrySchema,
  updateTimeEntrySchema,
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
