import { describe, expect, it } from 'vitest';
import {
  knownRemoteLogIdsForTracker,
  splitAppAndDirect,
} from '../../shared/utils/monthly-report-split';

describe('splitAppAndDirect', () => {
  it('counts a known remoteLogId as App', () => {
    const byDay = splitAppAndDirect(
      [{ remoteLogId: '11', spentOn: '2026-08-03', durationSeconds: 3600 }],
      new Set(['11']),
    );
    expect(byDay.get('2026-08-03')).toEqual({ appSeconds: 3600, directSeconds: 0 });
  });

  it('counts an unrecognized remoteLogId as Direct', () => {
    const byDay = splitAppAndDirect(
      [{ remoteLogId: '99', spentOn: '2026-08-03', durationSeconds: 1800 }],
      new Set(['11']),
    );
    expect(byDay.get('2026-08-03')).toEqual({ appSeconds: 0, directSeconds: 1800 });
  });

  it('does not treat the same remote log id on another tracker as App', () => {
    const known = knownRemoteLogIdsForTracker(
      [
        { trackerId: 'tracker-a', remoteLogId: '11' },
        { trackerId: 'tracker-b', remoteLogId: '99' },
      ],
      'tracker-a',
    );
    const byDay = splitAppAndDirect(
      [
        { remoteLogId: '11', spentOn: '2026-08-03', durationSeconds: 3600 },
        { remoteLogId: '99', spentOn: '2026-08-03', durationSeconds: 1800 },
      ],
      known,
    );
    expect(byDay.get('2026-08-03')).toEqual({ appSeconds: 3600, directSeconds: 1800 });
  });
});
