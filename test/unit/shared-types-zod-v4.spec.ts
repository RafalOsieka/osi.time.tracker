import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProjectSchema } from '../../shared/types/project';
import { createRemoteSystemConfigSchema } from '../../shared/types/remote-system-config';
import { bulkAssignSchema, startTimeEntrySchema } from '../../shared/types/time-entry';

/** Deterministic UUIDv7-shaped value (version nibble 7, RFC variant). */
const VALID_UUID_V7 = '01900000-0000-7000-8000-000000000000';
/** Invalid version nibble (not nil/max sentinel) — rejected by z.uuid(). */
const MALFORMED_UUID = '00000000-0000-0000-0000-000000000001';

describe('shared types zod v4 identifier schemas (REQ-234)', () => {
  it('rejects a non-RFC UUID on identifier fields', () => {
    const project = createProjectSchema.safeParse({ name: 'Acme', clientId: MALFORMED_UUID });
    expect(project.success).toBe(false);

    const bulk = bulkAssignSchema.safeParse({
      ids: [MALFORMED_UUID],
      title: 'Work',
    });
    expect(bulk.success).toBe(false);

    const start = startTimeEntrySchema.safeParse({ projectId: MALFORMED_UUID });
    expect(start.success).toBe(false);
  });

  it('accepts a UUIDv7 identifier', () => {
    const project = createProjectSchema.safeParse({ name: 'Acme', clientId: VALID_UUID_V7 });
    expect(project.success).toBe(true);

    const bulk = bulkAssignSchema.safeParse({
      ids: [VALID_UUID_V7],
      title: 'Work',
    });
    expect(bulk.success).toBe(true);

    const start = startTimeEntrySchema.safeParse({ projectId: VALID_UUID_V7 });
    expect(start.success).toBe(true);
  });
});

describe('shared types zod v4 idiom (no deprecated options)', () => {
  it('contains no required_error, invalid_type_error, or message: options', () => {
    const typesDir = join(process.cwd(), 'shared', 'types');
    const files = readdirSync(typesDir).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(typesDir, file), 'utf8');
      if (
        /\brequired_error\b/.test(source) ||
        /\binvalid_type_error\b/.test(source) ||
        // message: option on schema checks (not JSDoc/comments about messages)
        /\{[^{}]*\bmessage\s*:/.test(source)
      ) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('uses top-level format constructors rather than method forms', () => {
    const typesDir = join(process.cwd(), 'shared', 'types');
    const files = readdirSync(typesDir).filter((name) => name.endsWith('.ts'));
    const joined = files.map((file) => readFileSync(join(typesDir, file), 'utf8')).join('\n');

    // Deprecated method forms chained off z.string(...)
    expect(joined).not.toMatch(/\.string\s*\([^)]*\)\s*\.uuid\s*\(/);
    expect(joined).not.toMatch(/\.string\s*\([^)]*\)\s*\.url\s*\(/);
    expect(joined).not.toMatch(/\.string\s*\([^)]*\)\s*\.datetime\s*\(/);
    expect(joined).toMatch(/z\.uuid\s*\(/);
    expect(joined).toMatch(/z\s*\.\s*url\s*\(/);
    expect(joined).toMatch(/z\.iso\.datetime\s*\(/);
  });
});

describe('remoteExecutionModeSchema.default input typing', () => {
  it('treats executionMode as optional on create input', () => {
    const result = createRemoteSystemConfigSchema.safeParse({
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      roundingRule: 'none',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executionMode).toBe('client');
    }
  });
});
