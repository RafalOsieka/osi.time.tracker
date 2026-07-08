import { describe, expect, it } from 'vitest';
import { updateTaskSchema, TASK_NAME_MAX_LENGTH } from '../../shared/types/task';
import { mapZodError } from '../../server/utils/zod-error';

const validProjectId = '018f2f8a-1234-7abc-8def-123456789abc';

describe('updateTaskSchema', () => {
  it('parses valid body, trims whitespace, and strips unknown keys', () => {
    const input = {
      name: '  Fix the bug  ',
      projectId: validProjectId,
      extraKey: 'should-be-removed',
    };
    const result = updateTaskSchema.parse(input);
    expect(result).toEqual({
      name: 'Fix the bug',
      projectId: validProjectId,
    });
    expect((result as Record<string, unknown>).extraKey).toBeUndefined();
  });

  it('fails parse if name is missing', () => {
    expect(() => updateTaskSchema.parse({})).toThrow();
  });

  it('fails parse if name is empty or only whitespace', () => {
    expect(() => updateTaskSchema.parse({ name: '' })).toThrow();
    expect(() => updateTaskSchema.parse({ name: '   ' })).toThrow();
  });

  it('fails parse if name exceeds max length', () => {
    const longName = 'a'.repeat(TASK_NAME_MAX_LENGTH + 1);
    expect(() => updateTaskSchema.parse({ name: longName })).toThrow();
  });

  it('accepts name at exactly max length', () => {
    const maxName = 'a'.repeat(TASK_NAME_MAX_LENGTH);
    const result = updateTaskSchema.parse({ name: maxName });
    expect(result.name).toBe(maxName);
  });

  it('accepts an omitted projectId (project-less task)', () => {
    const result = updateTaskSchema.parse({ name: 'Standalone task' });
    expect(result.projectId).toBeUndefined();
  });

  it('accepts an explicit null projectId (project-less task)', () => {
    const result = updateTaskSchema.parse({ name: 'Standalone task', projectId: null });
    expect(result.projectId).toBeNull();
  });

  it('fails parse if projectId is not a valid uuid', () => {
    expect(() => updateTaskSchema.parse({ name: 'Valid Name', projectId: 'not-a-uuid' })).toThrow();
  });

  it('does not accept a number field as part of the request body schema', () => {
    expect('number' in updateTaskSchema.shape).toBe(false);
  });

  it('maps missing name to error.taskNameRequired via mapZodError', () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({
        messageKey: 'error.taskNameRequired',
        params: { expected: 'string', received: 'undefined' },
      });
    }
  });

  it('maps an invalid projectId to error.taskProjectInvalid via mapZodError', () => {
    const result = updateTaskSchema.safeParse({ name: 'Valid Name', projectId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mapped = mapZodError(result.error);
      expect(mapped).toEqual({ messageKey: 'error.taskProjectInvalid' });
    }
  });
});
