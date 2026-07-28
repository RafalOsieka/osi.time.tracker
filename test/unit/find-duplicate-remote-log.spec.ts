import { describe, expect, it } from 'vitest';
import { findDuplicateRemoteLog } from '../../shared/utils/find-duplicate-remote-log';

const log = (id: string, durationSeconds: number, comment: string | null = null) => ({
  remoteLogId: id,
  durationSeconds,
  comment,
});

describe('findDuplicateRemoteLog', () => {
  it('returns the log with equal duration', () => {
    const match = log('a', 3600, 'same length');
    expect(findDuplicateRemoteLog(3600, [log('b', 1800), match])).toEqual(match);
  });

  it('returns null when durations differ', () => {
    expect(findDuplicateRemoteLog(3600, [log('a', 1800), log('b', 900)])).toBeNull();
  });

  it('returns null for an empty log list', () => {
    expect(findDuplicateRemoteLog(3600, [])).toBeNull();
  });

  it('returns null when exportSeconds is zero or negative', () => {
    expect(findDuplicateRemoteLog(0, [log('a', 0)])).toBeNull();
    expect(findDuplicateRemoteLog(-1, [log('a', -1)])).toBeNull();
  });

  it('returns the first of multiple equal-duration candidates', () => {
    const first = log('first', 1800, 'one');
    const second = log('second', 1800, 'two');
    expect(findDuplicateRemoteLog(1800, [first, second])).toBe(first);
  });
});
