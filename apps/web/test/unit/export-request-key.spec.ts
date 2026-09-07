import { describe, expect, it } from 'vitest';
import { buildExportRequestKey } from '../../shared/utils/export-request-key';

const base = {
  taskId: '11111111-1111-4111-8111-111111111111',
  localDate: '2026-03-15',
  entryIds: ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'],
  exportDurationSeconds: 3600,
};

describe('buildExportRequestKey', () => {
  it('is stable across entry-id ordering', () => {
    const a = buildExportRequestKey(base);
    const b = buildExportRequestKey({
      ...base,
      entryIds: [...base.entryIds].reverse(),
    });
    expect(a).toBe(b);
  });

  it('changes when the export duration changes', () => {
    const a = buildExportRequestKey(base);
    const b = buildExportRequestKey({ ...base, exportDurationSeconds: 1800 });
    expect(a).not.toBe(b);
  });

  it('changes when the entry selection changes', () => {
    const a = buildExportRequestKey(base);
    const b = buildExportRequestKey({
      ...base,
      entryIds: [base.entryIds[0]!],
    });
    expect(a).not.toBe(b);
  });

  it('differs per task', () => {
    const a = buildExportRequestKey(base);
    const b = buildExportRequestKey({
      ...base,
      taskId: '44444444-4444-4444-8444-444444444444',
    });
    expect(a).not.toBe(b);
  });

  it('differs per date', () => {
    const a = buildExportRequestKey(base);
    const b = buildExportRequestKey({ ...base, localDate: '2026-03-16' });
    expect(a).not.toBe(b);
  });

  it('uses a versioned, deterministic string form', () => {
    expect(buildExportRequestKey(base)).toMatch(/^er1\|/);
  });
});
