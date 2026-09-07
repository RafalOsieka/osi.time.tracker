import { describe, expect, it } from 'vitest';
import {
  resolveDefaultExportComment,
  resolveExportComment,
} from '../../shared/utils/export-comment';

describe('resolveDefaultExportComment', () => {
  it('uses the first non-empty remote-log comment', () => {
    expect(resolveDefaultExportComment('Task', [null, '  latest note  ', 'older'])).toBe(
      'latest note',
    );
  });

  it('falls back to the task name when no remote comments exist', () => {
    expect(resolveDefaultExportComment('Ship it', [null, '', '   '])).toBe('Ship it');
  });

  it('falls back to the task name for an empty log list', () => {
    expect(resolveDefaultExportComment('Ship it', [])).toBe('Ship it');
  });
});

describe('resolveExportComment', () => {
  it('returns the trimmed comment when present', () => {
    expect(resolveExportComment('  hello  ', 'Task')).toBe('hello');
  });

  it('falls back to the task name when empty or whitespace', () => {
    expect(resolveExportComment('', 'Task')).toBe('Task');
    expect(resolveExportComment('   ', 'Task')).toBe('Task');
    expect(resolveExportComment(null, 'Task')).toBe('Task');
    expect(resolveExportComment(undefined, 'Task')).toBe('Task');
  });
});
