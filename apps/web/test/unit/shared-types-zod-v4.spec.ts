import { describe, expect, it } from 'vitest';
import { createProjectSchema } from '../../shared/types/project';
import { createTrackerSchema } from '../../shared/types/tracker';
import { bulkAssignSchema, startTimeEntrySchema } from '../../shared/types/time-entry';

/** Deterministic UUIDv7-shaped value (version nibble 7, RFC variant). */
const VALID_UUID_V7 = '01900000-0000-7000-8000-000000000000';
/** Invalid version nibble (not nil/max sentinel) — rejected by z.uuid(). */
const MALFORMED_UUID = '00000000-0000-0000-0000-000000000001';

describe('shared types zod v4 identifier schemas (REQ-172)', () => {
  it('rejects a non-RFC UUID on identifier fields', () => {
    const project = createProjectSchema.safeParse({ name: 'Acme', trackerId: MALFORMED_UUID });
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
    const project = createProjectSchema.safeParse({ name: 'Acme', trackerId: VALID_UUID_V7 });
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

describe('trackerDirectBrowserAccessSchema.default input typing', () => {
  it('treats directBrowserAccess as optional on create input', () => {
    const result = createTrackerSchema.safeParse({
      name: 'Acme',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
      roundingRule: 'none',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.directBrowserAccess).toBe(true);
    }
  });
});
