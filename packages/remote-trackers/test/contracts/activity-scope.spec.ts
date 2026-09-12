import { describe, expect, it } from 'vitest';
import { resolveActivityScope, TRACKER_SYSTEM_TYPE_ORDER } from '@osi/remote-trackers/contracts';

describe('resolveActivityScope', () => {
  it('resolves every registered system type without throwing', () => {
    for (const systemType of TRACKER_SYSTEM_TYPE_ORDER) {
      expect(() => resolveActivityScope(systemType, '42')).not.toThrow();
    }
  });

  it('gives OpenProject issues a distinct scope per work package', () => {
    expect(resolveActivityScope('openproject', '1')).not.toBe(
      resolveActivityScope('openproject', '2'),
    );
  });

  it('gives every Redmine issue the same tracker-wide scope', () => {
    expect(resolveActivityScope('redmine', '1')).toBe(resolveActivityScope('redmine', '2'));
  });
});
