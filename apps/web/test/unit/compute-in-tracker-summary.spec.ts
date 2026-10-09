import { describe, expect, it } from 'vitest';
import { computeInTrackerSummary } from '../../shared/utils/compute-in-tracker-summary';

const loaded = (trackerId: string, logs: { remoteLogId: string; durationSeconds: number }[]) => ({
  trackerId,
  name: trackerId,
  loading: false,
  loaded: true,
  errorKey: null,
  logs,
});

describe('computeInTrackerSummary', () => {
  it('adds all current-account logs including logs outside exports and to-send', () => {
    expect(
      computeInTrackerSummary(
        [loaded('one', [{ remoteLogId: 'external', durationSeconds: 900 }])],
        300,
      ),
    ).toEqual({ status: 'ready', logsSeconds: 900, toSendSeconds: 300, totalSeconds: 1200 });
  });

  it('deduplicates shared logs per tracker, but not across trackers', () => {
    expect(
      computeInTrackerSummary(
        [
          loaded('one', [{ remoteLogId: '5', durationSeconds: 900 }]),
          loaded('one', [{ remoteLogId: '5', durationSeconds: 900 }]),
          loaded('two', [{ remoteLogId: '5', durationSeconds: 600 }]),
        ],
        0,
      ),
    ).toEqual({ status: 'ready', logsSeconds: 1500, toSendSeconds: 0, totalSeconds: 1500 });
  });

  it('does not show a sum while any tracker loads', () => {
    expect(
      computeInTrackerSummary(
        [
          loaded('one', [{ remoteLogId: '5', durationSeconds: 900 }]),
          { ...loaded('two', []), loaded: false, loading: true },
        ],
        300,
      ),
    ).toEqual({ status: 'loading' });
  });

  it('reports errors without a partial sum', () => {
    expect(
      computeInTrackerSummary(
        [
          loaded('one', [{ remoteLogId: '5', durationSeconds: 900 }]),
          { ...loaded('two', []), errorKey: 'error.remoteTimeLogsFetchFailed' },
        ],
        300,
      ),
    ).toEqual({
      status: 'unavailable',
      trackers: [{ name: 'two', messageKey: 'error.remoteTimeLogsFetchFailed', retryable: true }],
    });
  });

  it('does not offer retry for an unavailable extension', () => {
    expect(
      computeInTrackerSummary(
        [{ ...loaded('mobile', []), errorKey: 'error.extensionUnavailable' }],
        300,
      ),
    ).toEqual({
      status: 'unavailable',
      trackers: [{ name: 'mobile', messageKey: 'error.extensionUnavailable', retryable: false }],
    });
  });

  it('immediately reflects zero to-send', () => {
    expect(
      computeInTrackerSummary([loaded('one', [{ remoteLogId: '5', durationSeconds: 900 }])], 0),
    ).toEqual({ status: 'ready', logsSeconds: 900, toSendSeconds: 0, totalSeconds: 900 });
  });
});
