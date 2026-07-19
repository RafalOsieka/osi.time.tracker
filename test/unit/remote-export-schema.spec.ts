import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { finalizeRemoteExportSchema } from '../../shared/types/remote-export';
import { mapZodError } from '../../server/utils/zod-error';

describe('finalizeRemoteExportSchema', () => {
  const valid = {
    taskId: '01900000-0000-7000-8000-000000000001',
    localDate: '2026-03-15',
    remoteIssueId: '42',
    remoteLogId: '9001',
    exportDurationSeconds: 3600,
    requiredFieldValues: { activity: '1' },
    entryIds: ['01900000-0000-7000-8000-0000000000aa'],
  };

  it('parses a valid finalization body', () => {
    expect(finalizeRemoteExportSchema.parse(valid)).toEqual(valid);
  });

  it('defaults requiredFieldValues to an empty object', () => {
    const { requiredFieldValues: _ignored, ...rest } = valid;
    const result = finalizeRemoteExportSchema.parse(rest);
    expect(result.requiredFieldValues).toEqual({});
  });

  it('rejects a missing entry list', () => {
    expect(() => finalizeRemoteExportSchema.parse({ ...valid, entryIds: [] })).toThrow();
  });

  it('rejects a non-positive duration', () => {
    expect(() =>
      finalizeRemoteExportSchema.parse({ ...valid, exportDurationSeconds: 0 }),
    ).toThrow();
  });

  it('rejects an invalid local date', () => {
    expect(() => finalizeRemoteExportSchema.parse({ ...valid, localDate: '15-03-2026' })).toThrow();
  });

  it('rejects an invalid task id', () => {
    expect(() => finalizeRemoteExportSchema.parse({ ...valid, taskId: 'nope' })).toThrow();
  });

  it('maps validation failures to { messageKey, params } via mapZodError', () => {
    try {
      finalizeRemoteExportSchema.parse({ ...valid, remoteLogId: '' });
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const mapped = mapZodError(err as ZodError);
      expect(mapped.messageKey).toBe('error.remoteExportRemoteLogIdRequired');
    }
  });
});
