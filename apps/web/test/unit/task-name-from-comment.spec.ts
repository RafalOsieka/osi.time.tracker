import { describe, expect, it } from 'vitest';
import { taskNameFromComment } from '../../server/utils/task-name-from-comment';

describe('taskNameFromComment', () => {
  it('uses the trimmed comment as the task name', () => {
    expect(taskNameFromComment('  Fix invoice rounding  ')).toBe('Fix invoice rounding');
  });

  it('falls back to "empty" for a null comment', () => {
    expect(taskNameFromComment(null)).toBe('empty');
  });

  it('falls back to "empty" for a whitespace-only comment', () => {
    expect(taskNameFromComment('   ')).toBe('empty');
  });

  it('falls back to "empty" for an empty string', () => {
    expect(taskNameFromComment('')).toBe('empty');
  });
});
