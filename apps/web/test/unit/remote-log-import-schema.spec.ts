import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  IMPORT_REMOTE_LOGS_MAX_PER_REQUEST,
  importRemoteLogsSchema,
  type ImportRemoteLogDto,
} from '../../shared/types/remote-log-import';
import { mapZodError } from '../../server/utils/zod-error';

function log(overrides: Partial<ImportRemoteLogDto> = {}): ImportRemoteLogDto {
  return {
    remoteLogId: '9001',
    remoteIssueId: '42',
    spentOn: '2026-03-15',
    durationSeconds: 3600,
    activityId: '1',
    comment: 'Fix rounding',
    ...overrides,
  };
}

function validBody(overrides: { dryRun?: boolean; logs?: ImportRemoteLogDto[] } = {}) {
  return {
    dryRun: overrides.dryRun ?? false,
    groups: [
      {
        projectId: '01900000-0000-7000-8000-000000000001',
        logs: overrides.logs ?? [log()],
      },
    ],
  };
}

describe('importRemoteLogsSchema', () => {
  it('parses a valid dry-run body', () => {
    const body = validBody({ dryRun: true });
    expect(importRemoteLogsSchema.parse(body)).toEqual(body);
  });

  it('parses a valid write body', () => {
    const body = validBody({ dryRun: false });
    expect(importRemoteLogsSchema.parse(body)).toEqual(body);
  });

  it('accepts a log with null activityId and comment', () => {
    const body = validBody({ logs: [log({ activityId: null, comment: null })] });
    expect(importRemoteLogsSchema.parse(body)).toEqual(body);
  });

  it('accepts optional remoteIssueTitle and remoteProjectTitle', () => {
    const body = validBody({
      logs: [log({ remoteIssueTitle: 'Fix rounding', remoteProjectTitle: 'CMPL' })],
    });
    expect(importRemoteLogsSchema.parse(body)).toEqual(body);
  });

  it('rejects empty groups', () => {
    expect(() => importRemoteLogsSchema.parse({ dryRun: false, groups: [] })).toThrow();
  });

  it('rejects a group with no logs', () => {
    expect(() =>
      importRemoteLogsSchema.parse({
        dryRun: false,
        groups: [{ projectId: '01900000-0000-7000-8000-000000000001', logs: [] }],
      }),
    ).toThrow();
  });

  it('rejects duplicate remote log ids across groups', () => {
    const body = {
      dryRun: false,
      groups: [
        { projectId: '01900000-0000-7000-8000-000000000001', logs: [log({ remoteLogId: 'x1' })] },
        { projectId: '01900000-0000-7000-8000-000000000002', logs: [log({ remoteLogId: 'x1' })] },
      ],
    };
    expect(() => importRemoteLogsSchema.parse(body)).toThrow();
  });

  it('rejects more than 500 logs in one request', () => {
    const logs = Array.from({ length: IMPORT_REMOTE_LOGS_MAX_PER_REQUEST + 1 }, (_, i) =>
      log({ remoteLogId: `l${i}` }),
    );
    expect(() => importRemoteLogsSchema.parse(validBody({ logs }))).toThrow();
  });

  it('accepts exactly 500 logs', () => {
    const logs = Array.from({ length: IMPORT_REMOTE_LOGS_MAX_PER_REQUEST }, (_, i) =>
      log({ remoteLogId: `l${i}` }),
    );
    expect(() => importRemoteLogsSchema.parse(validBody({ logs }))).not.toThrow();
  });

  it('rejects a non-positive duration', () => {
    expect(() =>
      importRemoteLogsSchema.parse(validBody({ logs: [log({ durationSeconds: 0 })] })),
    ).toThrow();
  });

  it('rejects a malformed spentOn date', () => {
    expect(() =>
      importRemoteLogsSchema.parse(validBody({ logs: [log({ spentOn: '15-03-2026' })] })),
    ).toThrow();
  });

  it('rejects an invalid projectId', () => {
    expect(() =>
      importRemoteLogsSchema.parse({
        dryRun: false,
        groups: [{ projectId: 'nope', logs: [log()] }],
      }),
    ).toThrow();
  });

  it('maps validation failures to { messageKey, params } via mapZodError', () => {
    try {
      importRemoteLogsSchema.parse(validBody({ logs: [log({ remoteLogId: '' })] }));
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      if (!(err instanceof ZodError)) throw err;
      const mapped = mapZodError(err);
      expect(mapped.messageKey).toBe('error.remoteLogImportRemoteLogIdRequired');
    }
  });

  it('maps the too-many-logs failure to its messageKey', () => {
    const logs = Array.from({ length: IMPORT_REMOTE_LOGS_MAX_PER_REQUEST + 1 }, (_, i) =>
      log({ remoteLogId: `l${i}` }),
    );
    try {
      importRemoteLogsSchema.parse(validBody({ logs }));
      throw new Error('expected parse to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      if (!(err instanceof ZodError)) throw err;
      const mapped = mapZodError(err);
      expect(mapped.messageKey).toBe('error.remoteLogImportTooManyLogs');
    }
  });
});
